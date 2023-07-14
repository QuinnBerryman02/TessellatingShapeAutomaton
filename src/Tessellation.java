package src;

import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

import java.awt.Color;

import src.datastructs.*;
import src.util.GeometryUtil.*;
import src.util.Util.*;

public class Tessellation {
    public Shape shape;
    public Map<Symmetry, List<RelativeRule>> virtualNeighbourMap = new HashMap<>();
    public Map<Symmetry, Vector> offsetVectors = new HashMap<>();
    public Vector basisVector1;
    public Vector basisVector2;
    public HashGraph<Point,Symmetry,Boolean> hashGraph = new HashGraph<>();
    public static Color[] colorCodes = {Color.cyan, Color.pink, Color.green, Color.yellow, Color.red,  Color.magenta, Color.orange, Color.lightGray, Color.darkGray};
    public static Color[] coolColorCodes = {new Color(3,51,71), new Color(129,160,225), new Color(8,142,199), new Color(150,212,203), Color.orange};

    public Tessellation(Shape shape, List<RelativeRule> rules) {
        this.shape = shape;
        System.out.println("Creating a new shape from " + rules);
        Map<Symmetry, List<RelativeRule>> relativeRuleMap = calculateRelativeRuleMap(rules);
        System.out.println(relativeRuleMap);
        Map<Symmetry, Set<Point>> examplePointsMap = generateMoreExamplePoints(relativeRuleMap);
        calculateOffsetVectors(examplePointsMap);
        Set<Point> centeredPoints = getCenteredPoints(examplePointsMap);
        deriveBasisVectors(centeredPoints);
        findBetterOffsetVectors(examplePointsMap);
        generateVirtualNeighbourMap(relativeRuleMap);
        setupHashGraph();
    }

    //creating the relative rule map
    private Map<Symmetry, List<RelativeRule>> calculateRelativeRuleMap(List<RelativeRule> rules) {
        Map<Symmetry, List<RelativeRule>> relativeRuleMap = new HashMap<>();
        relativeRuleMap.put(Symmetry.IDENTITY, rules);
        for (Symmetry sym : rules.stream().map(r -> r.symmetry).distinct().toList()) {
            updateRelativeRuleMap(sym, relativeRuleMap);
        }
        return relativeRuleMap;
    }

    private void updateRelativeRuleMap(Symmetry symmetry, Map<Symmetry, List<RelativeRule>> relativeRuleMap) {
        if(relativeRuleMap.containsKey(symmetry)) return;
        relativeRuleMap.put(symmetry, relativeRuleMap.get(Symmetry.IDENTITY).stream().map(r -> r.transform(symmetry)).toList());
    }
    //creating the example points for each symmetry
    private Map<Symmetry, Set<Point>> generateMoreExamplePoints(Map<Symmetry, List<RelativeRule>> relativeRuleMap) {
        Map<Symmetry, Set<Point>> examplePointsMap = new HashMap<>();
        relativeRuleMap.keySet().forEach(s -> examplePointsMap.put(s, new HashSet<>()));
        for (RelativeRule firstRule : relativeRuleMap.get(Symmetry.IDENTITY)) {
            for(RelativeRule secondRule : relativeRuleMap.get(firstRule.symmetry)) {
                if(!examplePointsMap.containsKey(secondRule.symmetry)) {
                    updateRelativeRuleMap(secondRule.symmetry, relativeRuleMap);
                    examplePointsMap.put(secondRule.symmetry, new HashSet<>());
                }
                examplePointsMap.get(secondRule.symmetry).add(firstRule.point.add(secondRule.point)); 
            }
        }
        return examplePointsMap;
    }
    //finding the offset vectors
    private void calculateOffsetVectors(Map<Symmetry, Set<Point>> examplePointsMap) {
        for(Symmetry sym : examplePointsMap.keySet()) {
            Set<Point> points = examplePointsMap.get(sym);
            Point closestToOrigin = points.stream().min(Comparator.comparingInt(p -> p.eulerDistance())).orElse(null);
            offsetVectors.put(sym, closestToOrigin.toVector());
        }
    }
    //centering the points
    private Set<Point> getCenteredPoints(Map<Symmetry, Set<Point>> examplePointsMap) {
        Set<Point> centeredPoints = new HashSet<>();
        for(Symmetry sym : examplePointsMap.keySet()) {
            Set<Point> points = examplePointsMap.get(sym);
            Vector offset = offsetVectors.get(sym);
            centeredPoints.addAll(points.stream().map(p -> p.sub(offset)).toList());
        }
        return centeredPoints;
    }
    //finding the basis vectors
    private void deriveBasisVectors(Set<Point> centeredPoints) {
        basisVector1 = centeredPoints.stream()
        .min(Comparator.comparingInt(Point::non0EulerDistance)).orElse(null).pointOnRight().toVector();

        Point secondBasisEstimate = basisVector1.toPoint().transform(Symmetry.ROT_90);

        basisVector2 = centeredPoints.stream().filter(secondBasisEstimate.toLine()::pointOnLine)
        .min(Comparator.comparingInt(Point::non0EulerDistance)).orElse(null).pointOnRight().toVector();
        
        if(basisVector1.toPoint().angle() > basisVector2.toPoint().angle()) {
            Vector temp = basisVector1;
            basisVector1 = basisVector2;
            basisVector2 = temp;
        }
    }

    public Point realToVirtual(Point point, Symmetry symmetry) {
        Vector offset = offsetVectors.get(symmetry);
        return point.sub(offset).matrixMultiplyInverse(basisVector1, basisVector2);
    }

    public Point virtualToReal(Point point, Symmetry symmetry) {
        Vector offset = offsetVectors.get(symmetry);
        return point.matrixMultiply(basisVector1, basisVector2).add(offset);
    } 

    public void generateVirtualNeighbourMap(Map<Symmetry, List<RelativeRule>> relativeRuleMap) {
        for (Symmetry mainSymmetry : relativeRuleMap.keySet()) {
            virtualNeighbourMap.put(mainSymmetry, relativeRuleMap.get(mainSymmetry).stream().map(r -> {
                Point recentered = realToVirtual(r.point.add(offsetVectors.get(mainSymmetry)), r.symmetry);
                return new RelativeRule(r.declaringCode, r.symmetry, recentered);
            }).toList());
        }
    }

    public void findBetterOffsetVectors(Map<Symmetry, Set<Point>> examplePointsMap) {
        Predicate<Point> centerParallelogram = p -> realToVirtual(p, Symmetry.IDENTITY).equals(Point.ORIGIN);
        for (Symmetry symmetry : examplePointsMap.keySet()) {
            System.out.println(symmetry + " -examplePoints>>> " + examplePointsMap);
            Point offset = examplePointsMap.get(symmetry).stream().filter(centerParallelogram).min(Comparator.comparingInt(Point::eulerDistance)).orElse(null);
            offsetVectors.put(symmetry, offset.toVector());
        }
    }

    public Point shapeCenter(HashGraph<Point,Symmetry,Boolean>.Cluster.Node node) {
        return virtualToReal(node.getCluster().getKey(), node.getKey());
    }

    public void setupHashGraph() {
        hashGraph.setNeighbourFunction((kp) -> {
            List<RelativeRule> ruleList = virtualNeighbourMap.get(kp.key2);
            return ruleList.stream().map(r -> hashGraph.new KeyPair(r.point.add(kp.key1), r.symmetry)).toList();
        });

        var node = hashGraph.put(new Point(0,0), Symmetry.IDENTITY, true);
        for(int i=0;i<20;i++) {
            hashGraph.traverse(node).forEach(n -> n.createNeighbours(true));
        }
    }

    public void drawToPlane(Plane plane) {
        Rect rect = new Rect(0, 0, plane.getImage().getWidth(), plane.getImage().getHeight());
        Symmetry symmetry;
        Point point;
        Color color = Color.white;
        List<Color> neighbourColors;
        for (var node : hashGraph.traverse(hashGraph.get(Point.ORIGIN, Symmetry.IDENTITY))) {
            symmetry = node.getKey();
            point = shapeCenter(node).add(plane.center());
            neighbourColors = node.getPresentNeighbours().stream().map(n -> {
                return shapeCenter(n).add(plane.center());
            }).map(p -> {
                if(!rect.inside(p)) return 0;
                return plane.getImage().getRGB(p.x(), p.y());
            }).distinct().map(i -> new Color(i, true)).toList();
            for(int i=0;i<4;i++) {
                if(neighbourColors.contains(coolColorCodes[i])) continue;
                else color = coolColorCodes[i]; break;
            }
            placeShape(symmetry, point, color, plane);
        }
    }

    public boolean placeShape(Symmetry symmetry, Point center, Color color, Plane plane) {
        Point transformedShapeCenter = shape.getCenterTransformed(symmetry);
        Point bitmapTL = center.sub(transformedShapeCenter);
        return plane.placeBitmap(bitmapTL, shape.getBitmap().transform(symmetry), color);
    }

    public static void main(String[] args) {
        
    }

    public static final Tessellation SMALL_L_2 = new TessellationSetup(Shape.SMALL_L_SHAPE,
        new Pair<>(Symmetry.IDENTITY, new Point(2, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(-2, 0)),
        new Pair<>(Symmetry.ROT_90, new Point(0, -1)),
        new Pair<>(Symmetry.ROT_90, new Point(2, -1)),
        new Pair<>(Symmetry.ROT_90, new Point(0, 2)),
        new Pair<>(Symmetry.ROT_90, new Point(2, 2)))
        .toTessellation();

    public static final Tessellation SQUARE_1 = new TessellationSetup(Shape.SQUARE,
        new Pair<>(Symmetry.IDENTITY, new Point(2, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(-2, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(0, -2)),
        new Pair<>(Symmetry.IDENTITY, new Point(0, 2))).toTessellation();

    public static final Tessellation JAGGED_4 = new TessellationSetup(Shape.JAGGED,
        new Pair<>(Symmetry.IDENTITY, new Point(0, 2)),
        new Pair<>(Symmetry.IDENTITY, new Point(2, 0)),
        new Pair<>(Symmetry.ROT_180, new Point(-1, 0)),
        new Pair<>(Symmetry.ROT_180, new Point(1, 0)),
        new Pair<>(Symmetry.ROT_180, new Point(-1, 2)),
        new Pair<>(Symmetry.ROT_180, new Point(4, 5))).toTessellation();

    public static final Tessellation BOWL_6 = new TessellationSetup(Shape.BOWL,
        new Pair<>(Symmetry.IDENTITY, new Point(8, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(-8, 0)),
        new Pair<>(Symmetry.ROT_180, new Point(3, 0)),
        new Pair<>(Symmetry.ROT_180, new Point(11, 0)),
        new Pair<>(Symmetry.ROT_180, new Point(3, 5)),
        new Pair<>(Symmetry.ROT_180, new Point(11, 5))).toTessellation();

    public static final Tessellation DOMINO_5 = new TessellationSetup(Shape.DOMINO,
        new Pair<>(Symmetry.IDENTITY, new Point(0, 1)),
        new Pair<>(Symmetry.ROT_90, new Point(-1, 0)),
        new Pair<>(Symmetry.ROT_90, new Point(2, 0)),
        new Pair<>(Symmetry.ROT_90, new Point(0, -2)),
        new Pair<>(Symmetry.ROT_90, new Point(1, -2))).toTessellation();

    public static final Tessellation DOMINO_4 = new TessellationSetup(Shape.DOMINO,
        new Pair<>(Symmetry.IDENTITY, new Point(-2, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(2, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(0, -1)),
        new Pair<>(Symmetry.IDENTITY, new Point(0, 1))).toTessellation();

        public static final Tessellation DOMINO_6_STRAIGHT = new TessellationSetup(Shape.DOMINO,
        new Pair<>(Symmetry.IDENTITY, new Point(-2, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(2, 0)),
        new Pair<>(Symmetry.IDENTITY, new Point(-1, -1)),
        new Pair<>(Symmetry.IDENTITY, new Point(1, -1)),
        new Pair<>(Symmetry.IDENTITY, new Point(-1, 1)),
        new Pair<>(Symmetry.IDENTITY, new Point(1, 1))).toTessellation();

        public static final Tessellation DOMINO_6_ZIG_ZAG = new TessellationSetup(Shape.DOMINO,
        new Pair<>(Symmetry.ROT_90, new Point(-1, 0)),
        new Pair<>(Symmetry.ROT_90, new Point(2, -1)),
        new Pair<>(Symmetry.IDENTITY, new Point(-1, -1)),
        new Pair<>(Symmetry.IDENTITY, new Point(1, 1)),
        new Pair<>(Symmetry.ROT_90, new Point(1, -2)),
        new Pair<>(Symmetry.ROT_90, new Point(0, 1))).toTessellation();
}
