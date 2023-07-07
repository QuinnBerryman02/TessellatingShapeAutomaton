package src;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.awt.Color;

import src.GeometryUtil.*;

public class RegularTessellation {
    private static final boolean DEBUG = false;
    private Shape shape;
    private Matrix<Integer> mat;
    private int W;
    private int H;
    private Map<Integer, DefShape> defShapes = new HashMap<>();
    private Point center;
    private Color[] colorCodes = {Color.black, Color.cyan, Color.pink, Color.green, Color.yellow, Color.red,  Color.magenta, Color.orange, Color.lightGray, Color.darkGray};

    public RegularTessellation(Shape shape) {
        this.shape = shape;
        int shapeWidth = shape.getBitmap().getWidth();
        int shapeHeight = shape.getBitmap().getHeight();
        int maxDim = Math.max(shapeWidth, shapeHeight);
        W = shapeWidth + 2 * maxDim;
        H = shapeHeight + 2 * maxDim;
        mat = new Matrix<>(W, H, 0);
        mat.setColorMap(i -> colorCodes[i]);

        center = new Point(maxDim, maxDim).add(shape.getCenter());
        DefShape.setup(shape, center, mat);
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
        return areAllBorderTilesOccupied() && doBorderShapesFollowRules();
    }

    public boolean areAllBorderTilesOccupied() {
        return shape.findBorderPoints().stream().allMatch(p -> {
            return mat.get(p.y() + center.y(), p.x() + center.x()) != 0;
        });
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

    public boolean doBorderShapesFollowRules() {
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
                    failedCodes.add(code);
                }   
                if(DEBUG) System.out.println("shape " + currentShape.code + " in symmetry " + shapeSymmetry + " was " + (currentShape.followsRules(shapeSymmetry) ? "valid" : "invalid"));   
            }
        }
        for (DefShape shape : getBorderShapes()) {
            if(DEBUG) System.out.println(shape.code + "'s neighbours = " + shape.validNeigbourRules);
        }
        reduceRules();
        for (DefShape shape : getBorderShapes()) {
            if(DEBUG) System.out.println(shape.code + " neighbours = " + shape.validNeigbourRules);
        }
        return getBorderShapes().stream().allMatch(DefShape::followsRules);
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

    public void reduceRules() {
        List<RelativeRule> incorrectRules = new ArrayList<>();
        do {
            incorrectRules = removeInvalidSymmetries(incorrectRules);
        } while (!incorrectRules.isEmpty());
    }

    public static void main(String[] args) {
        // RegularTessellation regTes1 = new RegularTessellation(Shape.SMALL_L_SHAPE);
        // regTes1.defShape(new Point(0, 2), Symmetry.IDENTITY);
        // regTes1.defShape(new Point(4, 2), Symmetry.IDENTITY);
        // regTes1.defShape(new Point(2, 1), Symmetry.ROT_90);
        // regTes1.defShape(new Point(4, 1), Symmetry.ROT_90);
        // regTes1.defShape(new Point(2, 4), Symmetry.ROT_90);
        // regTes1.defShape(new Point(4, 4), Symmetry.ROT_90);
        // System.out.println(regTes1.borderTilesOccupied()); 
        // regTes1.mat.print();
        // regTes1.borderShapesFollowRules();

        RegularTessellation regTes2 = new RegularTessellation(Shape.JAGGED);
        regTes2.addShape(Symmetry.IDENTITY, new Point(3, 5));
        regTes2.addShape(Symmetry.IDENTITY, new Point(5, 3));
        regTes2.addShape(Symmetry.ROT_180, new Point(2, 5));
        regTes2.addShape(Symmetry.ROT_180, new Point(2, 3));
        regTes2.addShape(Symmetry.ROT_180, new Point(4, 3));
        regTes2.addShape(Symmetry.ROT_180, new Point(7, 8));

        regTes2.mat.print();
        System.out.println("border tiles occupied : " + regTes2.areAllBorderTilesOccupied()); 
        System.out.println("border shapes following rules : " + regTes2.doBorderShapesFollowRules());
    }
}

class DefShape {
    public static int NUMBER_OF_SHAPES = 0;
    public static Shape shape;
    public static Matrix<Integer> plane;
    public static Point mainCenter;

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
    
    public static void setup(Shape _shape, Point _center, Matrix<Integer> _plane) {
        shape = _shape; 
        mainCenter = _center;
        plane = _plane;
    }
    public DefShape(Symmetry chosenSymmetry, Point chosenCenter) {
        this.code = ++NUMBER_OF_SHAPES;
        this.initialAbsCenter = chosenCenter;
        this.initialRelCenter = initialAbsCenter.sub(mainCenter);
        this.initialSymmetry = chosenSymmetry;
        
        this.potentialSymmetries = shape.findSymmetriesThatLookTheSame(initialSymmetry);
        if(code == 1) potentialSymmetries = new ArrayList<>(List.of(Symmetry.IDENTITY));
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
        return plane.pointAfterTransformation(getAbsoluteCenter(shapeSymmetry), planeSymmetry);
    }
    
    public AbsoluteRule getAbsoluteRule(Symmetry shapeSymmetry, Symmetry planeSymmetry) {
        return new AbsoluteRule(code, shapeSymmetry.apply(planeSymmetry), getAbsoluteCenter(shapeSymmetry, planeSymmetry));
    }

    public RelativeRule getRelativeRule(Symmetry shapeSymmetry) {
        return new RelativeRule(code, shapeSymmetry, getAbsoluteCenter(shapeSymmetry).sub(mainCenter));
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
            setTrueSymmetry(sym);
        }
    }

    public void setTrueSymmetry(Symmetry sym) {
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
}

