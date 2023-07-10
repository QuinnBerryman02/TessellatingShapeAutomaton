package src;

import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

import java.awt.Color;

import src.GeometryUtil.*;
import src.Util.*;

public class Tessellation {
    public Shape shape;
    public Map<Symmetry, List<RelativeRule>> virtualNeighbourMap = new HashMap<>();
    public Map<Symmetry, Vector> offsetVectors = new HashMap<>();
    public Vector basisVector1;
    public Vector basisVector2;
    public HashGraph<Point,Symmetry,Boolean> hashGraph = new HashGraph<>();

    public Tessellation(Shape shape, List<RelativeRule> rules) {
        this.shape = shape;
        Map<Symmetry, List<RelativeRule>> relativeRuleMap = calculateRelativeRuleMap(rules);
        Map<Symmetry, Set<Point>> examplePointsMap = generateMoreExamplePoints(relativeRuleMap);
        calculateOffsetVectors(examplePointsMap);
        Set<Point> centeredPoints = getCenteredPoints(examplePointsMap);
        deriveBasisVectors(centeredPoints);
        findBetterOffsetVectors(examplePointsMap);
        generateVirtualNeighbourMap(relativeRuleMap);
        System.out.println("Relative Neighbours");
        offsetVectors.keySet().forEach(s -> System.out.println(s + " " + relativeRuleMap.get(s)));
        System.out.println("Virtual Neighbours");
        offsetVectors.keySet().forEach(s -> System.out.println(s + " " + virtualNeighbourMap.get(s)));
        System.out.println("Offset Vectors : " + offsetVectors);
        System.out.println("BV1 : " + basisVector1 + " with angle " + basisVector1.toPoint().angle());
        System.out.println("BV2 : " + basisVector2 + " with angle " + basisVector2.toPoint().angle());

        hashGraph.setNeighbourFunction((kp) -> {
            List<RelativeRule> ruleList = virtualNeighbourMap.get(kp.key2);
            return ruleList.stream().map(r -> hashGraph.new KeyPair(r.point.add(kp.key1), r.symmetry)).toList();
        });

        var node = hashGraph.put(new Point(0,0), Symmetry.IDENTITY, true);
        // System.out.println("iter 1 : " + hashGraph.sizeFrom(node));
        // hashGraph.traverse(node).forEach(n -> n.generateNeighbours(true));
        // System.out.println("iter 2 : " + hashGraph.sizeFrom(node));
        // hashGraph.traverse(node).forEach(n -> n.generateNeighbours(true));
        // System.out.println("iter 3 : " + hashGraph.sizeFrom(node));
        // hashGraph.traverse(node).forEach(n -> n.generateNeighbours(true));
        // System.out.println("iter 4 : " + hashGraph.sizeFrom(node));
        // hashGraph.traverse(node).forEach(n -> n.generateNeighbours(true));
        // System.out.println("iter 5 : " + hashGraph.sizeFrom(node));
        System.out.println("iter 0 : " + hashGraph.sizeFrom(node));
        for(int i=1;i<100;i++) {
            long start = System.nanoTime();
            hashGraph.traverse(node).forEach(n -> n.generateNeighbours(true));
            long end = System.nanoTime();
            System.out.println("iter " + i + " : " + hashGraph.sizeFrom(node) + " - took " + ((end - start)/1000000) + "ms");
        }

        // Matrix<String> mat =  new Matrix<>(31, 31, ".");
        // hashGraph.traverse(node).forEach(n -> {
        //     Point p = shapeCenter(n).add(new Point(16,16));
        //     placeShape(n.getKey(), p, mat);
        // });
        // Color[] colorCodes = {Color.black, Color.cyan, Color.pink, Color.green, Color.yellow, Color.red,  Color.magenta, Color.orange, Color.lightGray, Color.darkGray};
        // mat.setColorMap(str -> {
        //     Symmetry sym = Arrays.stream(Symmetry.values()).filter(s -> s.simple().equals(str)).findFirst().orElse(null);
        //     if(sym == null) return colorCodes[0];
        //     else return colorCodes[sym.ordinal()+1];
        // });
        // mat.print();
        System.out.println();
        System.out.println();
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
            Point offset = examplePointsMap.get(symmetry).stream().filter(centerParallelogram).min(Comparator.comparingInt(Point::eulerDistance)).orElse(null);
            offsetVectors.put(symmetry, offset.toVector());
        }
    }

    public boolean placeShape(Symmetry transformation, Point center, Matrix<String> matrix) {
        Point transformedShapeCenter = shape.getCenterTransformed(transformation);
        Point bitmapTL = center.sub(transformedShapeCenter);
        boolean canPlace = placeBitmap(bitmapTL, shape.getBitmap().transform(transformation), transformation.simple(), matrix);
        return canPlace;
    }

    private <T> boolean placeBitmap(Point p, Matrix<Boolean> bm, T value, Matrix<T> matrix) {
        int bmw=bm.getWidth(), bmh=bm.getHeight();
        Rect plane = new Rect(0, 0, matrix.getWidth() - bmw + 1, matrix.getHeight() - bmh + 1);
        if(!plane.inside(p)) return false;
        //checking if its safe
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j) && matrix.get(i+p.y(), j+p.x()) != ".") return false;
            }
        }
        //placing
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j)) matrix.set(i+p.y(), j+p.x(), value);
            }
        }
        return true;
    }

    public Point shapeCenter(HashGraph<Point,Symmetry,Boolean>.Cluster.Node node) {
        return virtualToReal(node.getCluster().getKey(), node.getKey());
    }

    public static void main(String[] args) {
        TessellationSetup ts1 = new TessellationSetup(Shape.SMALL_L_SHAPE);
        ts1.addShape(Symmetry.IDENTITY, new Point(0, 2));
        ts1.addShape(Symmetry.IDENTITY, new Point(4, 2));
        ts1.addShape(Symmetry.ROT_90, new Point(2, 1));
        ts1.addShape(Symmetry.ROT_90, new Point(4, 1));
        ts1.addShape(Symmetry.ROT_90, new Point(2, 4));
        ts1.addShape(Symmetry.ROT_90, new Point(4, 4));
        ts1.print();
        Tessellation t1 = ts1.toTessellation();

        TessellationSetup ts2 = new TessellationSetup(Shape.JAGGED);
        ts2.addShape(Symmetry.IDENTITY, new Point(3, 5));
        ts2.addShape(Symmetry.IDENTITY, new Point(5, 3));
        ts2.addShape(Symmetry.ROT_180, new Point(2, 5));
        ts2.addShape(Symmetry.ROT_180, new Point(2, 3));
        ts2.addShape(Symmetry.ROT_180, new Point(4, 3));
        ts2.addShape(Symmetry.ROT_180, new Point(7, 8));
        ts2.print();
        Tessellation t2 = ts2.toTessellation();

        TessellationSetup ts3 = new TessellationSetup(Shape.SQUARE);
        ts3.addShape(Symmetry.IDENTITY, new Point(4, 2));
        ts3.addShape(Symmetry.IDENTITY, new Point(2, 4));
        ts3.addShape(Symmetry.IDENTITY, new Point(0, 2));
        ts3.addShape(Symmetry.IDENTITY, new Point(2, 0));
        ts3.print();
        Tessellation t3 = ts3.toTessellation();
    }
}