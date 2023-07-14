package src;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import src.GeometryUtil.*;
import src.Util.*;

public class Shape {
    private static final boolean T=true,F=false;
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
        if(points.isEmpty()) return;
        this.center = points.get(0);
       
    }

    public Matrix<Boolean> getBitmap() {
        return bitmap;
    }

    public Point getCenter() {
        return center;
    }

    public boolean isConnected() {
        if(points.isEmpty()) return false;
        List<Point> used = new ArrayList<>();
        List<Point> unused = new ArrayList<>(points);
        Point current = unused.remove(0);
        used.add(current);
        while(!used.isEmpty()) {
            current = used.remove(0);
            current.getAdjacentPoints().forEach(p -> {
                if(unused.remove(p)) used.add(p);
            });
        }
        return unused.isEmpty();
    }

    public boolean wellFitted() {
        if(points.isEmpty()) return false;
        int minX=Integer.MAX_VALUE,minY=Integer.MAX_VALUE,maxX=Integer.MIN_VALUE,maxY=Integer.MIN_VALUE;
        for (Point point : points) {
            if(point.x() > maxX) maxX = point.x();
            if(point.y() > maxY) maxY = point.y();
            if(point.x() < minX) minX = point.x();
            if(point.y() < minY) minY = point.y();
        }
        return minX == 0 && minY == 0 && maxX == bitmap.getWidth()-1 && maxY == bitmap.getHeight()-1;
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

        BOWL.bitmap.print();
    }

    public static final Shape DOMINO = new Shape(new Matrix<>(new Boolean[][]{{T,T}}));
    public static final Shape SQUARE = new Shape(new Matrix<Boolean>(new Boolean[][]{{T,T}, {T,T}}));
    public static final Shape L_SHAPE = new Shape(new Matrix<Boolean>(new Boolean[][] {{T,F},{T,F},{T,T}}));
    public static final Shape SMALL_L_SHAPE = new Shape(new Matrix<Boolean>(new Boolean[][] {{T,F},{T,T}}));
    public static final Shape JAGGED = new Shape(new Matrix<Boolean>(new Boolean[][] {{T,F,F}, {T,T,F},{F,T,T}}));
    public static final Shape BOWL = new Shape(new Matrix<Boolean>(new Boolean[][] {{T,T,F,F,F,F,T,T},{T,T,T,T,T,T,T,T},{F,T,T,T,T,T,T,F},{F,F,F,T,T,F,F,F}}));

}