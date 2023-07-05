package src;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import src.GeometryUtil.*;

public class RegularTessellation {
    private Shape shape;
    private Matrix<Integer> mat;
    private int W;
    private int H;
    private int shapeCounter = 0;
    private Map<Symmetry, TrueShapeCenters> trueShapeCenters;
    private RelativeShapeCenters relativeShapeCenters;
    private Point center;

    public RegularTessellation(Shape shape) {
        this.shape = shape;
        int shapeWidth = shape.getBitmap().getWidth();
        int shapeHeight = shape.getBitmap().getHeight();
        int maxDim = Math.max(shapeWidth, shapeHeight);
        this.W = shapeWidth + 2 * maxDim;
        this.H = shapeHeight + 2 * maxDim;
        this.mat = new Matrix<>(W, H, 0);
        this.trueShapeCenters = new HashMap<>();
        this.relativeShapeCenters = new RelativeShapeCenters(new Point(0, 0));
        this.center = new Point(maxDim, maxDim).add(shape.getCenter());
        trueShapeCenters.put(Symmetry.IDENTITY, new TrueShapeCenters(Symmetry.IDENTITY, new CentSym(center, Symmetry.IDENTITY, 1)));
        placeBitmap(center, shape.getBitmap(), ++shapeCounter);
    }

    public boolean addShape(Point p, Symmetry transformation) {
        Point transformedShapeCenter = shape.getBitmap().pointAfterTransformation(shape.getCenter(), transformation);
        Point bitmapTL = p.sub(transformedShapeCenter);
        Point relativeCenter = p.sub(center);
        relativeShapeCenters.others.add(new CentSym(relativeCenter, transformation,  ++shapeCounter));
        trueShapeCenters.get(Symmetry.IDENTITY).others.add(new CentSym(p, transformation,  shapeCounter));
        return placeBitmap(bitmapTL, shape.getBitmap().transform(transformation), shapeCounter);
    }

    private boolean placeBitmap(Point p, Matrix<Boolean> bm, int code) {
        int bmw=bm.getWidth(), bmh=bm.getHeight();
        Rect plane = new Rect(0, 0, W - bmw + 1, H - bmh + 1);
        if(!plane.inside(p)) return false;
        //checking if its safe
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j) && mat.get(i+p.y(), j+p.x()) != 0) {
                    shapeCounter--;
                    relativeShapeCenters.others.remove(relativeShapeCenters.others.size()-1);
                    return false;
                }
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

    public boolean borderTilesOccupied() {
        return shape.findBorderPoints().stream().allMatch(p -> {
            return mat.get(p.y() + center.y(), p.x() + center.x()) != 0;
        });
    }

    public boolean borderShapesFollowRules() {
        Map<Symmetry,Matrix<Integer>> planeTransformations = new HashMap<>();
        planeTransformations.put(Symmetry.IDENTITY, mat);
        for (CentSym centSym : relativeShapeCenters.others) {
            List<Symmetry> symmetriesToCheck = shape.findSymmetriesThatLookTheSame(centSym.symmetry);
            System.out.println("checking  " + centSym.code);
            for (Symmetry shapeSym : symmetriesToCheck) { 
                Symmetry planeTrans = shapeSym.inversion();
                if(!planeTransformations.containsKey(planeTrans)) {
                    Matrix<Integer> newPlane = mat.transform(planeTrans);
                    planeTransformations.put(planeTrans, newPlane);
                    CentSym mainPoint = new CentSym(newPlane.pointAfterTransformation(center, planeTrans), planeTrans, 1);
                    TrueShapeCenters transformedCenters = new TrueShapeCenters(planeTrans, mainPoint);
                    trueShapeCenters.put(planeTrans, transformedCenters);
                    for(CentSym cs : trueShapeCenters.get(Symmetry.IDENTITY).others) {
                        transformedCenters.others.add(
                            new CentSym(newPlane.pointAfterTransformation(cs.center, planeTrans), cs.symmetry.apply(planeTrans), cs.code)
                        );
                    }
                }
                System.out.println("plane is transformed by " + planeTrans.name());
                System.out.println("main center is " + trueShapeCenters.get(planeTrans).main);
                System.out.println("center we are checking is center is " + trueShapeCenters.get(planeTrans).find(centSym.code));
                System.out.println("relative centers we must check : " + relativeShapeCenters.others);
                System.out.println("locations of nearby centers : " + trueShapeCenters.get(planeTrans).others + " and " + trueShapeCenters.get(planeTrans).main);
                //starting from check center, look at all realative centers, treating check center as main
                //tile must be a center, or empty, or out of bounds
                //if you find a number, and the tile isnt a center, the symmetry is invalid for this borderSHape
                planeTransformations.get(planeTrans).print();
                CentSym toCheck = trueShapeCenters.get(planeTrans).find(centSym.code);
                Point checkCenter = toCheck.center;
                boolean valid = true;
                for (CentSym relativeCenter : relativeShapeCenters.others) {
                    Point otherCenter = checkCenter.add(relativeCenter.center);
                    Rect plane = new Rect(0, 0, W, H);
                    if(!plane.inside(otherCenter)) {
                        System.out.println("point " + otherCenter + " is oob, safe");
                        continue;
                    }
                    int code = planeTransformations.get(planeTrans).get(otherCenter.y(), otherCenter.x());
                    if(code == 0) {
                        System.out.println("point " + otherCenter + " is empty, safe");
                        continue;
                    }
                    CentSym shapeFound = trueShapeCenters.get(planeTrans).find(code);
                    boolean correctAppearance = shape.findSymmetriesThatLookTheSame(relativeCenter.symmetry).contains(shapeFound.symmetry);
                    if(correctAppearance && shapeFound.center.equals(otherCenter)) {
                        System.out.println("point " + otherCenter + " is a center and the correct orientation, safe");
                        continue;
                    }
                    System.out.println("point " + otherCenter + " did not match rules, failed");
                    valid = false;
                    break;
                }
                System.out.println(centSym.code + " with symmetry " + shapeSym + " is " + (valid ? "valid" : "invalid"));
                System.out.println();
            }
        }
        
        return false;
    }

    public void print() {
        for (int i = 0; i < H; i++) {
            for (int j = 0; j < W; j++) {
                System.out.print((mat.get(i,j) > 9 ? "" : " ") + mat.get(i,j) + " ");
            }
            System.out.println();
        }
        System.out.println();
    }

    public static void main(String[] args) {
        RegularTessellation regTes2 = new RegularTessellation(Shape.SMALL_L_SHAPE);
        regTes2.addShape(new Point(0, 2), Symmetry.IDENTITY);
        regTes2.addShape(new Point(4, 2), Symmetry.IDENTITY);
        regTes2.addShape(new Point(2, 1), Symmetry.ROT_90);
        regTes2.addShape(new Point(4, 1), Symmetry.ROT_90);
        regTes2.addShape(new Point(2, 4), Symmetry.ROT_90);
        System.out.println(regTes2.borderTilesOccupied()); 
        regTes2.addShape(new Point(4, 4), Symmetry.ROT_90);
        System.out.println(regTes2.borderTilesOccupied()); 
        regTes2.print();
        System.out.println(regTes2.relativeShapeCenters);

        System.out.println(Shape.SMALL_L_SHAPE.findSymmetriesThatLookTheSame(Symmetry.IDENTITY)); 

        regTes2.borderShapesFollowRules();
    }
}

class TrueShapeCenters {
    public Symmetry planeTransformation;
    public CentSym main;
    public List<CentSym> others;

    public TrueShapeCenters(Symmetry planeTransformation, CentSym main) {
        this.planeTransformation = planeTransformation;
        this.main = main;
        others = new ArrayList<>();
    }

    public CentSym find(int code) {
        if(main.code == code) return main;
        for (CentSym cs : others) {
            if(cs.code == code) return cs;
        }
        return null;
    }
}

class RelativeShapeCenters {
    public CentSym main;
    public List<CentSym> others;

    public RelativeShapeCenters(Point mainCenter) {
        main = new CentSym(mainCenter, Symmetry.IDENTITY, 0);
        main.certain = true;
        others = new ArrayList<>();
    }

    @Override
    public String toString() {
        return "main: " + main + "\nothers: " + others;
    }
}

class CentSym {
    public Point center;
    public Symmetry symmetry;
    public boolean certain = false;
    public int code;

    public CentSym(Point center, Symmetry symmetry, int code) {
        this.center = center;
        this.symmetry = symmetry;
        this.code = code;
    }
    
    public void setCertain(boolean certain) {
        this.certain = certain;
    }

    @Override
    public String toString() {
        return code + ":" + center + " = " + symmetry.name() + (certain ? "" : "?");
    }
}