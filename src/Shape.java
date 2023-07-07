package src;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import src.GeometryUtil.*;

public class Shape {
    private Matrix<Boolean> bitmap;
    private List<Point> points = new ArrayList<>();
    private Point center;

    public Shape(Matrix<Boolean> bitmap) {
        this.bitmap = bitmap;
        if(bitmap == null) throw new IllegalArgumentException("Shape must have a bitmap");
        for (int i = 0; i < bitmap.getHeight(); i++) {
            for (int j = 0; j < bitmap.getWidth(); j++) {
                if(bitmap.get(i,j)) points.add(new Point(j, i));
            }
        }
        this.center = points.get(0);
        if(!isConnected()) throw new IllegalArgumentException("Shape Tiles must be connected");
       
    }

    public Matrix<Boolean> getBitmap() {
        return bitmap;
    }

    public Point getCenter() {
        return center;
    }

    public boolean isConnected() {
        if(points.size() <= 1) return true;
        List<Point> used = new ArrayList<>();
        List<Point> unused = new ArrayList<>(points);
        Point current = unused.remove(0);
        used.add(current);
        while(!used.isEmpty()) {
            current = used.remove(0);
            current.findSurroundingPoints().forEach(p -> {
                if(unused.remove(p)) used.add(p);
            });
        }
        return unused.isEmpty();
    }

    public List<Point> findBorderPoints() {
        return points.stream()
        .flatMap(p -> p.getAdjacentPoints().stream())
        .distinct()
        .filter(p -> !points.contains(p)).collect(Collectors.toList());
    }

    public List<Symmetry> findSymmetriesThatLookTheSame(Symmetry symmetry) {
        Matrix<Boolean> goal = bitmap.transform(symmetry);
        return new ArrayList<>(Arrays.stream(Symmetry.values())
        .filter(sym -> bitmap.transform(sym).equals(goal)).toList());
    }

    public List<Symmetry> findSymmetriesThatAlign(Matrix<Boolean> map) {
        return Arrays.stream(Symmetry.values())
        .filter(sym -> map.transform(sym).equals(bitmap)).toList();
    }

    public Point getCenterTransformed(Symmetry transformation) {
        return bitmap.pointAfterTransformation(center, transformation);
    }

    public static void main(String[] args) {
        SQUARE.bitmap.print();
        
        System.out.println(SQUARE.findSymmetriesThatAlign(SQUARE.bitmap.rotate180()));

        L_SHAPE.bitmap.print();
        System.out.println(L_SHAPE.findSymmetriesThatAlign(L_SHAPE.bitmap.rotate90CW()));

        SMALL_L_SHAPE.bitmap.print();
        System.out.println(SMALL_L_SHAPE.findSymmetriesThatAlign(SMALL_L_SHAPE.bitmap.rotate180()));
    }

    public static final Shape SQUARE = new Shape(new Matrix<Boolean>(new Boolean[][]{{true, true}, {true, true}}));
    public static final Shape L_SHAPE = new Shape(new Matrix<Boolean>(new Boolean[][] {{true,false},{true,false},{true,true}}));
    public static final Shape SMALL_L_SHAPE = new Shape(new Matrix<Boolean>(new Boolean[][] {{true,false},{true,true}}));
    public static final Shape JAGGED = new Shape(new Matrix<Boolean>(new Boolean[][] {{true, false, false}, {true, true, false},{false, true, true}}));

}