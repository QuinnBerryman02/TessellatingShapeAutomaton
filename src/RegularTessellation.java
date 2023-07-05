package src;

import java.util.ArrayList;
import java.util.List;

import src.GeometryUtil.*;

public class RegularTessellation {
    private Shape shape;
    private Matrix<Integer> mat;
    private int W;
    private int H;
    private int shapeCounter = 0;
    private RelativeShapeCenters shapeCenters;
    private Point center;

    public RegularTessellation(Shape shape) {
        this.shape = shape;
        int shapeWidth = shape.getBitmap().getWidth();
        int shapeHeight = shape.getBitmap().getHeight();
        int maxDim = Math.max(shapeWidth, shapeHeight);
        this.W = shapeWidth + 2 * maxDim;
        this.H = shapeHeight + 2 * maxDim;
        this.mat = new Matrix<>(W, H, 0);
        this.shapeCenters = new RelativeShapeCenters(new Point(0, 0));
        this.center = new Point(maxDim, maxDim);
        placeBitmap(maxDim, maxDim, shape.getBitmap(), ++shapeCounter);
    }

    public boolean addShape(int x, int y, Symmetry transformation) {
        shapeCenters.others.add(new CentSym(new Point(x - center.x(), y - center.y()), transformation));
        return placeBitmap(x, y, shape.getBitmap().transform(transformation), ++shapeCounter);
    }

    private boolean placeBitmap(int x, int y, Matrix<Boolean> bm, int code) {
        int bmw=bm.getWidth(), bmh=bm.getHeight();
        if(x < 0 || x + bmw - 1 >= W) return false;
        if(y < 0 || y + bmh - 1 >= H) return false;
        //checking if its safe
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j) && mat.get(i+y, j+x) != 0) return false;
            }
        }
        //placing
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j)) mat.getData()[i+y][j+x] = code;
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
        List<Symmetry> possibleSymmetries = shapeCenters.others.stream()
        .flatMap(cs -> shape.findSymmetriesThatLookTheSame(cs.symmetry).stream())
        .distinct().toList();
        for (Symmetry symmetry : possibleSymmetries) {
            
        }
        System.out.println(possibleSymmetries);
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
        RegularTessellation regTes = new RegularTessellation(Shape.L_SHAPE);
        regTes.print();

        RegularTessellation regTes2 = new RegularTessellation(Shape.SMALL_L_SHAPE);
        regTes2.addShape(0, 2, Symmetry.IDENTITY);
        regTes2.addShape(4, 2, Symmetry.IDENTITY);
        regTes2.addShape(1, 1, Symmetry.ROT_90);
        regTes2.addShape(3, 1, Symmetry.ROT_90);
        regTes2.addShape(1, 4, Symmetry.ROT_90);
        System.out.println(regTes2.borderTilesOccupied()); 
        regTes2.addShape(3, 4, Symmetry.ROT_90);
        System.out.println(regTes2.borderTilesOccupied()); 
        regTes2.print();
        System.out.println(regTes2.shapeCenters);

        System.out.println(Shape.SMALL_L_SHAPE.findSymmetriesThatLookTheSame(Symmetry.IDENTITY)); 

        regTes2.borderShapesFollowRules();
    }
}

class RelativeShapeCenters {
    public CentSym main;
    public List<CentSym> others;

    public RelativeShapeCenters(Point mainCenter) {
        main = new CentSym(mainCenter, Symmetry.IDENTITY);
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

    public CentSym(Point center, Symmetry symmetry) {
        this.center = center;
        this.symmetry = symmetry;
    }

    @Override
    public String toString() {
        return center + " = " + symmetry.name() + (certain ? "" : "?");
    }
}