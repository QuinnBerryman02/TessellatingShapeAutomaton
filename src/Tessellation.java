package src;

import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import src.GeometryUtil.*;
import src.Util.*;

public class Tessellation {
    public Map<Symmetry, List<RelativeRule>> virtualNeighbourMap = new HashMap<>();
    public Map<Symmetry, Vector> offsetVectors = new HashMap<>();
    public Vector basisVector1;
    public Vector basisVector2;

    public Tessellation(Shape shape, List<RelativeRule> rules) {
        Map<Symmetry, List<RelativeRule>> relativeRuleMap = calculateRelativeRuleMap(rules);
        Map<Symmetry, Set<Point>> examplePointsMap = generateMoreExamplePoints(relativeRuleMap);
        calculateOffsetVectors(examplePointsMap);
        Set<Point> centeredPoints = getCenteredPoints(examplePointsMap);
        deriveBasisVectors(centeredPoints);
        generateVirtualNeighbourMap(rules);
        findBetterOffsetVectors(examplePointsMap);
        System.out.println("Virtual Neighbours");
        offsetVectors.keySet().forEach(s -> System.out.println(s + " " + virtualNeighbourMap.get(s)));
        System.out.println("Offset Vectors : " + offsetVectors);
        System.out.println("BV1 : " + basisVector1 + " with angle " + basisVector1.toPoint().angle());
        System.out.println("BV2 : " + basisVector2 + " with angle " + basisVector2.toPoint().angle());

        Parallelogram gram = new Parallelogram(basisVector1, basisVector2);
        Matrix<String> mat =  new Matrix<>(17, 17, ".");
        for (int i = 0; i < mat.getHeight(); i++) {
            for (int j = 0; j < mat.getWidth(); j++) {
                int x = j - 8;
                int y = i - 8;
                mat.set(i, j, gram.inside(new Point(x, y)) ? "#" : ".");
            }
        }
        offsetVectors.entrySet().forEach(e -> mat.set(e.getValue().vy()+8, e.getValue().vx()+8, e.getKey().simple()));
        mat.print();
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

    public void generateVirtualNeighbourMap(List<RelativeRule> rules) {
        List<RelativeRule> virtualRules = rules.stream().map(r -> {
            return new RelativeRule(r.declaringCode, r.symmetry, realToVirtual(r.point, r.symmetry));
        }).toList();
        virtualNeighbourMap.put(Symmetry.IDENTITY, virtualRules);
        for (Symmetry symmetry : offsetVectors.keySet().stream().filter(s -> !s.equals(Symmetry.IDENTITY)).toList()) {
            virtualNeighbourMap.put(symmetry, virtualRules.stream().map(r -> r.transform(symmetry)).toList());
        }
    }

    public void findBetterOffsetVectors(Map<Symmetry, Set<Point>> examplePointsMap) {
        Parallelogram gram = new Parallelogram(basisVector1, basisVector2);
        for (Symmetry symmetry : examplePointsMap.keySet()) {
            Point offset = examplePointsMap.get(symmetry).stream().filter(gram::inside).min(Comparator.comparingInt(Point::eulerDistance)).orElse(null);
            offsetVectors.put(symmetry, offset.toVector());
        }
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
