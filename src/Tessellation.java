package src;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import src.GeometryUtil.*;

public class Tessellation {
    public Map<Symmetry, Vector> offsetVectors = new HashMap<>();
    public Vector basisVector1;
    public Vector basisVector2;

    public Tessellation(Shape shape, List<RelativeRule> rules) {
        Map<Symmetry, List<RelativeRule>> relativeRuleMap = calculateRelativeRuleMap(rules);
        Map<Symmetry, Set<Point>> examplePointsMap = generateMoreExamplePoints(relativeRuleMap);
        calculateOffsetVectors(examplePointsMap);
        Set<Point> centeredPoints = getCenteredPoints(examplePointsMap);
        deriveBasisVectors(centeredPoints);

        System.out.println(offsetVectors);
        System.out.println(basisVector1 + " " + basisVector1.toPoint().angle());
        System.out.println(basisVector2 + " " + basisVector2.toPoint().angle());
        System.out.println(realToVirtual(basisVector1.toPoint(), Symmetry.IDENTITY));
        System.out.println(realToVirtual(basisVector2.toPoint(), Symmetry.IDENTITY));

        // for (var entry : examplePointsMap.entrySet()) {
        //     for(Point p : entry.getValue()) {
        //         Point centered = p.sub(offsetVectors.get(entry.getKey()));
        //         Point virtual = realToVirtual(p, entry.getKey());
        //         Point realAgain = virtualToReal(virtual, entry.getKey());
        //         Point realButDecentered = realAgain.sub(offsetVectors.get(entry.getKey()));
        //         System.out.println(p + " -> " + centered + " -> " + virtual + " -> " + realButDecentered + " -> " + realAgain + " >>> " + (p.equals(realAgain)));
        //     }
        // }
        // Point test = new Point(3,3);
        // System.out.println(test.matrixMultiply(new Vector(2, 1), new Vector(1, 2)));
    }

    //creating the relative rule map
    private Map<Symmetry, List<RelativeRule>> calculateRelativeRuleMap(List<RelativeRule> rules) {
        Map<Symmetry, List<RelativeRule>> relativeRuleMap = new HashMap<>();
        relativeRuleMap.put(Symmetry.IDENTITY, rules);
        for (Symmetry sym : rules.stream().map(r -> r.symmetry).distinct().toList()) {
            List<RelativeRule> transformedRules = new ArrayList<>();
            for (RelativeRule relativeRule : rules) {
                transformedRules.add(relativeRule.transform(sym));
            }
            relativeRuleMap.put(sym, transformedRules);
        }
        return relativeRuleMap;
    }
    //creating the example points for each symmetry
    private Map<Symmetry, Set<Point>> generateMoreExamplePoints(Map<Symmetry, List<RelativeRule>> relativeRuleMap) {
        Map<Symmetry, Set<Point>> examplePointsMap = new HashMap<>();
        relativeRuleMap.keySet().forEach(s -> examplePointsMap.put(s, new HashSet<>()));
        for (RelativeRule firstRule : relativeRuleMap.get(Symmetry.IDENTITY)) {
            for(RelativeRule secondRule : relativeRuleMap.get(firstRule.symmetry)) {
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

        basisVector2 = centeredPoints.stream().filter(secondBasisEstimate.toLinePredicate())
        .min(Comparator.comparingInt(Point::non0EulerDistance)).orElse(null).pointOnRight().toVector();
    }

    public Point realToVirtual(Point point, Symmetry symmetry) {
        Vector offset = offsetVectors.get(symmetry);
        return point.sub(offset).matrixMultiplyInverse(basisVector1, basisVector2);
    }

    public Point virtualToReal(Point point, Symmetry symmetry) {
        Vector offset = offsetVectors.get(symmetry);
        return point.matrixMultiply(basisVector1, basisVector2).add(offset);
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
