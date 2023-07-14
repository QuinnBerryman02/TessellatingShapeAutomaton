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

public class TessellationSetup {
    private static final boolean DEBUG = false;
    private Shape shape;
    private Matrix<Integer> mat;
    private int W;
    private int H;
    private Map<Integer, DefShape> defShapes = new HashMap<>();
    private Set<Symmetry> favouredSymetries = new HashSet<>(List.of(Symmetry.IDENTITY));
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
        addShape(Symmetry.IDENTITY, center);
    }

    @SafeVarargs
    public TessellationSetup(Shape shape, Pair<Symmetry,Point>... relativeRules) {
        this(shape);
        for (Pair<Symmetry,Point> rule : relativeRules) {
            addShape(rule.a, rule.b.add(center));
        }
        setup();
    }

    public void reset() {
        mat.setorator((i,j) -> 0);
        defShapes.clear();
        favouredSymetries.clear();
        favouredSymetries.add(Symmetry.IDENTITY);
        DefShape.NUMBER_OF_SHAPES = 0;
        addShape(Symmetry.IDENTITY, center);
    }

    public boolean addShape(Symmetry transformation, Point center) {
        DefShape defShape = new DefShape(transformation, center);
        Point transformedShapeCenter = shape.getCenterTransformed(transformation);
        Point bitmapTL = center.sub(transformedShapeCenter);
        boolean canPlace = placeBitmap(bitmapTL, shape.getBitmap().transform(transformation), defShape.code);
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

    public List<AbsoluteRule> getAllAbsoluteRules(Symmetry planeSymmetry) {
        return defShapes.values().stream()
        .flatMap(sh -> sh.getPotentialAbsoluteRules(planeSymmetry).stream()).toList();
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
        Map<Symmetry,Matrix<Integer>> planeTransformations = new HashMap<>();
        planeTransformations.put(Symmetry.IDENTITY, mat);
        List<RelativeRule> relativeRules = getAllRelativeRules();
        if(DEBUG) System.out.println("relative centers : " + relativeRules);
        for(DefShape currentShape : getBorderShapes()) {
            if(DEBUG) System.out.println("checking  " + currentShape.code);  
            for (Symmetry shapeSymmetry : currentShape.getPotentialSymmetries()) {
                Symmetry planeSymmetry = shapeSymmetry.inversion();
                Matrix<Integer> plane = planeTransformations.computeIfAbsent(planeSymmetry, mat::transform);
                Point currentCenter = currentShape.getAbsoluteCenter(shapeSymmetry, planeSymmetry);
                if(DEBUG) System.out.println("shape sym : " + shapeSymmetry + " plane sym : " + planeSymmetry);
                if(DEBUG) plane.print();
                if(DEBUG) System.out.println("abs center : " + currentCenter);

                List<AbsoluteRule> absoluteRules = getAllAbsoluteRules(planeSymmetry);
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
                        currentShape.validNeigbourRules.get(shapeSymmetry).add(rule);
                        if(DEBUG) System.out.println(trueRule + " OOB => safe");
                        continue;
                    }
                    int code = plane.get(testCenter.y(), testCenter.x());
                    if(code == 0) {
                        currentShape.validNeigbourRules.get(shapeSymmetry).add(rule);
                        if(DEBUG) System.out.println(trueRule + " EMPTY TILE => safe");
                        continue;
                    }
                    AbsoluteRule matchingCenter = findMatchingCenter(trueRule, absoluteRules);
                    if(matchingCenter != null) {
                        currentShape.validNeigbourRules.get(shapeSymmetry).add(rule);
                        if(DEBUG) System.out.println(trueRule + " DID MATCH => safe");
                        continue;
                    }
                    if(DEBUG) System.out.println(trueRule + " NO MATCH => failed");
                    //failedCodes.add(rule.declaringCode);
                }   
                if(DEBUG) System.out.println("shape " + currentShape.code + " in symmetry " + shapeSymmetry + " was " + (currentShape.followsRules(shapeSymmetry) ? "valid" : "invalid"));   
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
            for (Symmetry symmetry : List.copyOf(shape.validNeigbourRules.keySet())) {
                shape.validNeigbourRules.get(symmetry).removeIf(knownIncorrectRules::contains);
                boolean valid = shape.followsRules(symmetry);
                RelativeRule rule = shape.getRelativeRule(symmetry);
                if(!valid) {
                    newIncorrectRules.add(rule);
                    shape.discountSymmetry(symmetry);
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
            RelativeRule rule = currentShape.discountUnfavourableSymmetry();
            if(DEBUG) System.out.println("DISCOUNTING " + rule);
            removeIncorrectRules(List.of(rule));
        }
    }

    public void assignFinalRelativeRulesToMain() {
        DefShape mainShape = getMainShape();
        defShapes.values().forEach(bs -> mainShape.validNeigbourRules.get(mainShape.trueSymmetry).add(bs.trueRelRule));
    }

    public void print() { mat.print(); }

    public void report() {
        System.out.println("-------------------REPORT-------------------");
        mat.print();
        System.out.println("border tiles occupied : " + areAllBorderTilesOccupied()); 
        System.out.println("border shapes following rules : " + doBorderShapesFollowRules());
        System.out.println("Relative Rules Map");
        List<RelativeRule> trueRules = getMainShape().validNeigbourRules.get(Symmetry.IDENTITY);
        System.out.println(trueRules);
        boolean allEqual = true;
        for (DefShape shape : getBorderShapes()) {
            if(DEBUG) System.out.println("Shape " + shape.code + " = " + shape.validNeigbourRules);
            List<RelativeRule> checkRules = shape.validNeigbourRules.get(shape.trueSymmetry);
            if(checkRules == null) {
                System.out.println("Shape " + shape.code + " didnt have a neighbour rule set for " + shape.trueSymmetry);
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
        return new Tessellation(shape, getMainShape().validNeigbourRules.get(Symmetry.IDENTITY));
    }

    public static void main(String[] args) {
        TessellationSetup DOMINO_5 = new TessellationSetup(Shape.DOMINO,
        new Pair<>(Symmetry.IDENTITY, new Point(0, 1)),
        new Pair<>(Symmetry.ROT_90, new Point(-1, 0)),
        new Pair<>(Symmetry.ROT_90, new Point(2, 0)),
        new Pair<>(Symmetry.ROT_90, new Point(0, -2)),
        new Pair<>(Symmetry.ROT_90, new Point(1, -2)));
        System.out.println("im in oregon but im still driving");
        DOMINO_5.report();
        System.out.println("im in oregon but im still driving");
        DOMINO_5.report();
        System.out.println("im in oregon but im still driving");
        
        // TessellationSetup DOMINO_6_ZIG_ZAG = new TessellationSetup(Shape.DOMINO,
        // new Pair<>(Symmetry.ROT_90, new Point(-1, 0)),
        // new Pair<>(Symmetry.ROT_90, new Point(2, -1)),
        // new Pair<>(Symmetry.IDENTITY, new Point(-1, -1)),
        // new Pair<>(Symmetry.IDENTITY, new Point(1, 1)),
        // new Pair<>(Symmetry.ROT_90, new Point(1, -2)),
        // new Pair<>(Symmetry.ROT_90, new Point(0, 1)));
        // DOMINO_6_ZIG_ZAG.report();

        Tessellation t = DOMINO_5.toTessellation();
        System.out.println(t);
    }

    class DefShape {
        public static int NUMBER_OF_SHAPES = 0;
    
        public int code;
        public Point initialRelCenter;
        public Point initialAbsCenter;
        public Symmetry initialSymmetry;
    
        public List<Symmetry> potentialSymmetries;
        public Map<Symmetry, List<RelativeRule>> validNeigbourRules = new HashMap<>();
    
        public boolean certain = false;
        public Symmetry trueSymmetry;
        public RelativeRule trueRelRule;
        public AbsoluteRule trueAbsRule;
        
        public DefShape(Symmetry chosenSymmetry, Point chosenCenter) {
            this.code = ++NUMBER_OF_SHAPES;
            this.initialAbsCenter = chosenCenter;
            this.initialRelCenter = initialAbsCenter.sub(center);
            this.initialSymmetry = chosenSymmetry;
            
            this.potentialSymmetries = shape.findSymmetriesThatLookTheSame(initialSymmetry);
            if(code == 1) {
                potentialSymmetries = new ArrayList<>(List.of(Symmetry.IDENTITY));
                setTrueSymmetry(Symmetry.IDENTITY);
            }
            potentialSymmetries.forEach(sym -> validNeigbourRules.put(sym, new ArrayList<>()));
        }
        //calculates the shapes center point, in its default plane transform
        public Point getAbsoluteCenter(Symmetry shapeSymmetry) {
            Point oldCenterOffset = shape.getCenterTransformed(initialSymmetry);
            Point newSymCenterOffset = shape.getCenterTransformed(shapeSymmetry);
            Point symCenter = initialAbsCenter.sub(oldCenterOffset).add(newSymCenterOffset);
            return symCenter;
        }
        //calculates the shapes center point, in any plane transform
        public Point getAbsoluteCenter(Symmetry shapeSymmetry, Symmetry planeSymmetry) {
            return mat.pointAfterTransformation(getAbsoluteCenter(shapeSymmetry), planeSymmetry);
        }
        
        public AbsoluteRule getAbsoluteRule(Symmetry shapeSymmetry, Symmetry planeSymmetry) {
            return new AbsoluteRule(code, shapeSymmetry.apply(planeSymmetry), getAbsoluteCenter(shapeSymmetry, planeSymmetry));
        }
    
        public RelativeRule getRelativeRule(Symmetry shapeSymmetry) {
            return new RelativeRule(code, shapeSymmetry, getAbsoluteCenter(shapeSymmetry).sub(center));
        }
    
        public List<Symmetry> getPotentialSymmetries() {
            return potentialSymmetries;
        }
    
        public boolean followsRules() {
            return potentialSymmetries.stream().anyMatch(sym -> followsRules(sym));
        }
    
        public boolean followsRules(Symmetry symmetry) {
            Boolean[] neighboursPresent = new Boolean[NUMBER_OF_SHAPES];
            Arrays.fill(neighboursPresent, false);
            neighboursPresent[code-1] = true;
            validNeigbourRules.get(symmetry).forEach(r -> neighboursPresent[r.declaringCode-1] = true);
            return Arrays.stream(neighboursPresent).allMatch(b -> b == true);
        }
        public List<AbsoluteRule> getPotentialAbsoluteRules(Symmetry planeSymmetry) {
            return getPotentialSymmetries().stream()
            .map(sym -> getAbsoluteRule(sym, planeSymmetry)).toList();
        }
        public List<RelativeRule> getPotentialRelativeRules() {
            return getPotentialSymmetries().stream()
            .map(this::getRelativeRule).toList();
        }
    
        public void discountSymmetry(Symmetry sym) {
            validNeigbourRules.remove(sym);
            potentialSymmetries.remove(sym);
            if(potentialSymmetries.size() == 1) {
                setTrueSymmetry(potentialSymmetries.get(0));
            }
        }
    
        public RelativeRule discountUnfavourableSymmetry() {
            Symmetry discountable = potentialSymmetries.stream()
            .filter(sym -> !favouredSymetries.contains(sym))
            .findFirst().orElse(potentialSymmetries.get(0));
            discountSymmetry(discountable);
            return getRelativeRule(discountable);
        }
    
        public void setTrueSymmetry(Symmetry sym) {
            favouredSymetries.add(sym);
            certain = true;
            trueSymmetry = sym;
            trueRelRule = getRelativeRule(sym);
            trueAbsRule = getAbsoluteRule(sym, Symmetry.IDENTITY);
        }
    
        @Override
        public String toString() {
            return code + (certain ? "🗸" : "?") 
            + "\nPotential Center Info:\n\t" 
            + potentialSymmetries.stream()
            .map(sym -> (
                sym.simple() 
                + " : [abs=" 
                + getAbsoluteCenter(sym) 
                + "],[rel=" 
                + getRelativeRule(sym) 
                + "]"
            )).toList();
        }
    }
}

abstract class PositionRule {
    public Symmetry symmetry;
    public Point point;

    public PositionRule(Symmetry symmetry, Point point) {
        this.symmetry = symmetry;
        this.point = point;
    }

    @Override
    public boolean equals(Object obj) {
        if(!(obj instanceof PositionRule rule)) return false;
        boolean sameSymmetry = symmetry.equals(rule.symmetry);
        boolean samePoint = point.equals(rule.point);
        return (sameSymmetry && samePoint);
    }

    @Override
    public String toString() {
        return symmetry.simple() + "@" + point;
    }
}
//you will find a shape with this code and this symmetry at this point
//only valid for one planeTransform
class AbsoluteRule extends PositionRule {
    public int codeAtPlace;

    public AbsoluteRule(int codeAtPlace, Symmetry symmetry, Point point) {
        super(symmetry, point);
        this.codeAtPlace = codeAtPlace;
    }

    @Override
    public String toString() {
        return "{" + codeAtPlace + "@" + super.toString() + "}";
    }
}
//this code declares that you will find a shape with this symmetry at this point
class RelativeRule extends PositionRule {
    public int declaringCode;
    public boolean incorrect = false;

    public RelativeRule(int declaringCode, Symmetry symmetry, Point point) {
        super(symmetry, point);
        this.declaringCode = declaringCode;
    }

    public RelativeRule adjust(Point change) {
        return new RelativeRule(declaringCode, symmetry, point.add(change));
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

    public RelativeRule transform(Symmetry symmetry) {
        return new RelativeRule(declaringCode, this.symmetry.apply(symmetry), point.transform(symmetry));
    }
}

