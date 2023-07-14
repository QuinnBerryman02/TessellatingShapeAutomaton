package src;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.awt.Color;

import src.util.GeometryUtil.*;
import src.util.Util.*;
import src.datastructs.*;
import static src.util.Grouping.D4;
import src.util.Grouping.Permutation;

public class TessellationSetup {
    private static final boolean DEBUG = false;
    private Shape shape;
    private Matrix<Integer> mat;
    private int W;
    private int H;
    private Map<Integer, DefShape> defShapes = new HashMap<>();
    private Set<Permutation> favouredPermutations = new HashSet<>(List.of(D4.ID));
    private Point center;
    private Color[] colorCodes = {Color.black, Color.cyan, Color.pink, Color.green, Color.yellow, Color.red,  Color.magenta, Color.orange, Color.lightGray, Color.darkGray};

    public TessellationSetup(Shape shape) {
        System.out.println("TESTING");
        this.shape = shape;
        int shapeWidth = shape.getBitmap().getWidth();
        int shapeHeight = shape.getBitmap().getHeight();
        int maxDim = Math.max(shapeWidth, shapeHeight);
        W = shapeWidth + 2 * maxDim;
        H = shapeHeight + 2 * maxDim;
        mat = new Matrix<>(W, H, 0);
        mat.setColorMap(i -> colorCodes[i]);

        center = new Point(maxDim, maxDim).add(shape.getCenter());
        DefShape.NUMBER_OF_SHAPES = 0;
        addShape(D4.ID, center);
    }

    @SafeVarargs
    public TessellationSetup(Shape shape, Pair<Permutation,Point>... relativeRules) {
        this(shape);
        for (Pair<Permutation,Point> rule : relativeRules) {
            addShape(rule.a, rule.b.add(center));
        }
        setup();
    }

    public void reset() {
        mat.setorator((i,j) -> 0);
        defShapes.clear();
        favouredPermutations.clear();
        favouredPermutations.add(D4.ID);
        DefShape.NUMBER_OF_SHAPES = 0;
        addShape(D4.ID, center);
    }

    public boolean addShape(Permutation Permutation, Point center) {
        DefShape defShape = new DefShape(Permutation, center);
        Point transformedShapeCenter = shape.getCenterTransformed(Permutation);
        Point bitmapTL = center.sub(transformedShapeCenter);
        boolean canPlace = placeBitmap(bitmapTL, shape.getBitmap().transform(Permutation), defShape.code);
        if(canPlace) {
            defShapes.put(defShape.code, defShape);
        } else {
            DefShape.NUMBER_OF_SHAPES--;
        }
        return canPlace;
    }

    private boolean placeBitmap(Point p, Matrix<Boolean> bm, int code) {
        int bmw=bm.getWidth(), bmh=bm.getHeight();
        Rect plane = new Rect(0, 0, W - bmw + 1, H - bmh + 1);
        if(!plane.inside(p)) return false;
        //checking if its safe
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j) && mat.get(i+p.y(), j+p.x()) != 0) return false;
            }
        }
        //placing
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j)) mat.getData()[i+p.y()][j+p.x()] = code;
            }
        }
        return true;
    }

    public List<DefShape> getBorderShapes() {
        return getBorderShapesByCode(1);
    }

    public List<DefShape> getBorderShapesByCode(int code) {
        return defShapes.values().stream().filter(bs -> bs.code != code).toList();
    }

    public DefShape getMainShape() {
        return defShapes.get(1);
    }

    public boolean isValidTessellation() {
        if (DEBUG) System.out.println("Checking if valid...");
        if (DEBUG) System.out.println("border tiles occupied : " + areAllBorderTilesOccupied()); 
        if (DEBUG) System.out.println("border shapes following rules : " + doBorderShapesFollowRules());
        print();
        return areAllBorderTilesOccupied() && doBorderShapesFollowRules();
    }

    public boolean areAllBorderTilesOccupied() {
        return shape.findBorderPoints().stream().allMatch(p -> {
            return mat.get(p.y() + center.y(), p.x() + center.x()) != 0;
        });
    }

    public boolean doBorderShapesFollowRules() {
        return getBorderShapes().stream().allMatch(DefShape::followsRules);
    }

    public int numberOfBorderTilesOccupied() {
        return (int)shape.findBorderPoints().stream().filter(p -> {
            return mat.get(p.y() + center.y(), p.x() + center.x()) != 0;
        }).count();
    }

    public List<AbsoluteRule> getAllAbsoluteRules(Permutation planePermutation) {
        return defShapes.values().stream()
        .flatMap(sh -> sh.getPotentialAbsoluteRules(planePermutation).stream()).toList();
    }

    public List<RelativeRule> getAllRelativeRules() {
        return defShapes.values().stream()
        .flatMap(sh -> sh.getPotentialRelativeRules().stream()).toList();
    }

    public AbsoluteRule findMatchingCenter(PositionRule relRule, List<AbsoluteRule> list) {
        return list.stream().filter(r -> r.equals(relRule)).findFirst().orElse(null);
    }

    public DefShape findIndecisiveShape() {
        return getBorderShapes().stream().filter(bs -> !bs.certain).findFirst().orElse(null);
    }

    public void setup() {
        Map<Permutation,Matrix<Integer>> planePermutations = new HashMap<>();
        planePermutations.put(D4.ID, mat);
        List<RelativeRule> relativeRules = getAllRelativeRules();
        if(DEBUG) System.out.println("relative centers : " + relativeRules);
        for(DefShape currentShape : getBorderShapes()) {
            if(DEBUG) System.out.println("checking  " + currentShape.code);  
            for (Permutation shapePerm : currentShape.getPotentialSymmetries()) {
                Permutation planePerm = D4.getInverse(shapePerm);
                Matrix<Integer> plane = planePermutations.computeIfAbsent(planePerm, mat::transform);
                Point currentCenter = currentShape.getAbsoluteCenter(shapePerm, planePerm);
                if(DEBUG) System.out.println("shape perm : " + shapePerm + " plane perm : " + planePerm);
                if(DEBUG) plane.print();
                if(DEBUG) System.out.println("abs center : " + currentCenter);

                List<AbsoluteRule> absoluteRules = getAllAbsoluteRules(planePerm);
                if(DEBUG) System.out.println("abs : " + absoluteRules);
                List<Integer> failedCodes = new ArrayList<>(); //not sure if this is 100% legit, but i think it holds
                for (RelativeRule rule : relativeRules) {
                    RelativeRule trueRule = rule.adjust(currentCenter);
                    Point testCenter = trueRule.point;
                    if(failedCodes.contains((Integer)rule.declaringCode)) {
                        if(DEBUG) System.out.println(trueRule + " PARTNER IMPOSSIBLE => failed");
                        continue;
                    }
                    if(!plane.toRect().inside(testCenter)) {
                        currentShape.validNeigbourRules.get(shapePerm).add(rule);
                        if(DEBUG) System.out.println(trueRule + " OOB => safe");
                        continue;
                    }
                    int code = plane.get(testCenter.y(), testCenter.x());
                    if(code == 0) {
                        currentShape.validNeigbourRules.get(shapePerm).add(rule);
                        if(DEBUG) System.out.println(trueRule + " EMPTY TILE => safe");
                        continue;
                    }
                    AbsoluteRule matchingCenter = findMatchingCenter(trueRule, absoluteRules);
                    if(matchingCenter != null) {
                        currentShape.validNeigbourRules.get(shapePerm).add(rule);
                        if(DEBUG) System.out.println(trueRule + " DID MATCH => safe");
                        continue;
                    }
                    if(DEBUG) System.out.println(trueRule + " NO MATCH => failed");
                    //failedCodes.add(rule.declaringCode);
                }   
                if(DEBUG) System.out.println("shape " + currentShape.code + " in permutation " + shapePerm + " was " + (currentShape.followsRules(shapePerm) ? "valid" : "invalid"));   
            }
        }
        for (DefShape shape : getBorderShapes()) {
            if(DEBUG) System.out.println(shape.code + "'s neighbours = " + shape.validNeigbourRules);
        }
        removeIncorrectRules();
        for (DefShape shape : getBorderShapes()) {
            if(DEBUG) System.out.println(shape.code + " neighbours = " + shape.validNeigbourRules);
        }
        collapsePossiblilities();
        for (DefShape shape : getBorderShapes()) {
            if(DEBUG) System.out.println(shape.code + " neighbours = " + shape.validNeigbourRules);
        }
        assignFinalRelativeRulesToMain();
    }

    

    public List<RelativeRule> removeInvalidSymmetries(List<RelativeRule> knownIncorrectRules) {
        if(DEBUG) System.out.println("REMOVING INCORRECT SHAPE SYMMETRIES");
        List<RelativeRule> newIncorrectRules = new ArrayList<>();
        for (DefShape shape : getBorderShapes()) {
            for (Permutation perm : List.copyOf(shape.validNeigbourRules.keySet())) {
                shape.validNeigbourRules.get(perm).removeIf(knownIncorrectRules::contains);
                boolean valid = shape.followsRules(perm);
                RelativeRule rule = shape.getRelativeRule(perm);
                if(!valid) {
                    newIncorrectRules.add(rule);
                    shape.discountPermutation(perm);
                }
                if(DEBUG) System.out.println("shape " + rule + " is " + (valid ? "valid" : "invalid"));
            }
        }
        return newIncorrectRules;
    }

    public void removeIncorrectRules(List<RelativeRule> knownIncorrectRules) {
        do {
            knownIncorrectRules = removeInvalidSymmetries(knownIncorrectRules);
        } while (!knownIncorrectRules.isEmpty());
    }

    public void removeIncorrectRules() {
        removeIncorrectRules(List.of());
    }

    public void collapsePossiblilities() {
        DefShape currentShape;
        while ((currentShape = findIndecisiveShape()) != null) {
            RelativeRule rule = currentShape.discountUnfavourablePermutation();
            if(DEBUG) System.out.println("DISCOUNTING " + rule);
            removeIncorrectRules(List.of(rule));
        }
    }

    public void assignFinalRelativeRulesToMain() {
        DefShape mainShape = getMainShape();
        defShapes.values().forEach(bs -> mainShape.validNeigbourRules.get(mainShape.truePermutation).add(bs.trueRelRule));
    }

    public void print() { mat.print(); }

    public void report() {
        System.out.println("-------------------REPORT-------------------");
        mat.print();
        System.out.println("border tiles occupied : " + areAllBorderTilesOccupied()); 
        System.out.println("border shapes following rules : " + doBorderShapesFollowRules());
        System.out.println("Relative Rules Map");
        List<RelativeRule> trueRules = getMainShape().validNeigbourRules.get(D4.ID);
        System.out.println(trueRules);
        boolean allEqual = true;
        for (DefShape shape : getBorderShapes()) {
            if(DEBUG) System.out.println("Shape " + shape.code + " = " + shape.validNeigbourRules);
            List<RelativeRule> checkRules = shape.validNeigbourRules.get(shape.truePermutation);
            if(checkRules == null) {
                System.out.println("Shape " + shape.code + " didnt have a neighbour rule set for " + shape.truePermutation);
                allEqual = false;
                continue;
            }
            allEqual = allEqual && checkRules.containsAll(trueRules) && checkRules.size() == trueRules.size();
        }
        if(allEqual) {
            System.out.println("All shapes ended up with the same relative map!!! SUCCESS");
        } else {
            System.out.println("Not all shapes ended up with the same relative map!!! FAILURE");
        }
    }

    public Tessellation toTessellation() {
        if(!isValidTessellation()) return null;
        return new Tessellation(shape, getMainShape().validNeigbourRules.get(D4.ID));
    }

    public static void main(String[] args) {
        TessellationSetup DOMINO_5 = new TessellationSetup(Shape.DOMINO,
        new Pair<>(D4.ID, new Point(0, 1)),
        new Pair<>(D4.get("90"), new Point(-1, 0)),
        new Pair<>(D4.get("90"), new Point(2, 0)),
        new Pair<>(D4.get("90"), new Point(0, -2)),
        new Pair<>(D4.get("90"), new Point(1, -2)));
        System.out.println("im in oregon but im still driving");
        DOMINO_5.report();
        System.out.println("im in oregon but im still driving");
        DOMINO_5.report();
        System.out.println("im in oregon but im still driving");

        Tessellation t = DOMINO_5.toTessellation();
        System.out.println(t);
    }

    class DefShape {
        public static int NUMBER_OF_SHAPES = 0;
    
        public int code;
        public Point initialRelCenter;
        public Point initialAbsCenter;
        public Permutation initialPermutation;
    
        public List<Permutation> potentialSymmetries;
        public Map<Permutation, List<RelativeRule>> validNeigbourRules = new HashMap<>();
    
        public boolean certain = false;
        public Permutation truePermutation;
        public RelativeRule trueRelRule;
        public AbsoluteRule trueAbsRule;
        
        public DefShape(Permutation chosenPerm, Point chosenCenter) {
            this.code = ++NUMBER_OF_SHAPES;
            this.initialAbsCenter = chosenCenter;
            this.initialRelCenter = initialAbsCenter.sub(center);
            this.initialPermutation = chosenPerm;
            
            this.potentialSymmetries = shape.findPermutationsThatLookTheSame(initialPermutation);
            if(code == 1) {
                potentialSymmetries = new ArrayList<>(List.of(D4.ID));
                setTruePermutation(D4.ID);
            }
            potentialSymmetries.forEach(perm -> validNeigbourRules.put(perm, new ArrayList<>()));
        }
        //calculates the shapes center point, in its default plane transform
        public Point getAbsoluteCenter(Permutation shapePerm) {
            Point oldCenterOffset = shape.getCenterTransformed(initialPermutation);
            Point newSymCenterOffset = shape.getCenterTransformed(shapePerm);
            Point symCenter = initialAbsCenter.sub(oldCenterOffset).add(newSymCenterOffset);
            return symCenter;
        }
        //calculates the shapes center point, in any plane transform
        public Point getAbsoluteCenter(Permutation shapePerm, Permutation planePerm) {
            return mat.pointAfterPermutation(getAbsoluteCenter(shapePerm), planePerm);
        }
        
        public AbsoluteRule getAbsoluteRule(Permutation shapePerm, Permutation planePerm) {
            return new AbsoluteRule(code, D4.apply(shapePerm, planePerm), getAbsoluteCenter(shapePerm, planePerm));
        }
    
        public RelativeRule getRelativeRule(Permutation shapePerm) {
            return new RelativeRule(code, shapePerm, getAbsoluteCenter(shapePerm).sub(center));
        }
    
        public List<Permutation> getPotentialSymmetries() {
            return potentialSymmetries;
        }
    
        public boolean followsRules() {
            return potentialSymmetries.stream().anyMatch(perm -> followsRules(perm));
        }
    
        public boolean followsRules(Permutation perm) {
            Boolean[] neighboursPresent = new Boolean[NUMBER_OF_SHAPES];
            Arrays.fill(neighboursPresent, false);
            neighboursPresent[code-1] = true;
            validNeigbourRules.get(perm).forEach(r -> neighboursPresent[r.declaringCode-1] = true);
            return Arrays.stream(neighboursPresent).allMatch(b -> b == true);
        }
        public List<AbsoluteRule> getPotentialAbsoluteRules(Permutation planePerm) {
            return getPotentialSymmetries().stream()
            .map(perm -> getAbsoluteRule(perm, planePerm)).toList();
        }
        public List<RelativeRule> getPotentialRelativeRules() {
            return getPotentialSymmetries().stream()
            .map(this::getRelativeRule).toList();
        }
    
        public void discountPermutation(Permutation perm) {
            validNeigbourRules.remove(perm);
            potentialSymmetries.remove(perm);
            if(potentialSymmetries.size() == 1) {
                setTruePermutation(potentialSymmetries.get(0));
            }
        }
    
        public RelativeRule discountUnfavourablePermutation() {
            Permutation discountable = potentialSymmetries.stream()
            .filter(perm -> !favouredPermutations.contains(perm))
            .findFirst().orElse(potentialSymmetries.get(0));
            discountPermutation(discountable);
            return getRelativeRule(discountable);
        }
    
        public void setTruePermutation(Permutation perm) {
            favouredPermutations.add(perm);
            certain = true;
            truePermutation = perm;
            trueRelRule = getRelativeRule(perm);
            trueAbsRule = getAbsoluteRule(perm, D4.ID);
        }
    
        @Override
        public String toString() {
            return code + (certain ? "🗸" : "?") 
            + "\nPotential Center Info:\n\t" 
            + potentialSymmetries.stream()
            .map(perm -> (
                D4.getLabel(perm)
                + " : [abs=" 
                + getAbsoluteCenter(perm) 
                + "],[rel=" 
                + getRelativeRule(perm) 
                + "]"
            )).toList();
        }
    }
}

abstract class PositionRule {
    public Permutation permutation;
    public Point point;

    public PositionRule(Permutation perm, Point point) {
        this.permutation = perm;
        this.point = point;
    }

    @Override
    public boolean equals(Object obj) {
        if(!(obj instanceof PositionRule rule)) return false;
        boolean samePerm = permutation.equals(rule.permutation);
        boolean samePoint = point.equals(rule.point);
        return (samePerm && samePoint);
    }

    @Override
    public String toString() {
        return D4.getLabel(permutation) + "@" + point;
    }
}
//you will find a shape with this code and this permutation at this point
//only valid for one planeTransform
class AbsoluteRule extends PositionRule {
    public int codeAtPlace;

    public AbsoluteRule(int codeAtPlace, Permutation perm, Point point) {
        super(perm, point);
        this.codeAtPlace = codeAtPlace;
    }

    @Override
    public String toString() {
        return "{" + codeAtPlace + "@" + super.toString() + "}";
    }
}
//this code declares that you will find a shape with this permutation at this point
class RelativeRule extends PositionRule {
    public int declaringCode;
    public boolean incorrect = false;

    public RelativeRule(int declaringCode, Permutation perm, Point point) {
        super(perm, point);
        this.declaringCode = declaringCode;
    }

    public RelativeRule adjust(Point change) {
        return new RelativeRule(declaringCode, permutation, point.add(change));
    }

    @Override
    public String toString() {
        return "{" + declaringCode + ":" + super.toString() + (incorrect ? "X" : "?") + "}";
    }

    @Override
    public boolean equals(Object obj) {
        if(!(obj instanceof RelativeRule rule)) return false;
        return super.equals(obj) && rule.declaringCode == declaringCode;
    }

    public RelativeRule transform(Permutation permutation) {
        return new RelativeRule(declaringCode, D4.apply(this.permutation, permutation), point.transform(permutation));
    }
}

