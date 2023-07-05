package src;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import src.GeometryUtil.*;

public class Shape {
    private Bitmap bitmap;

    public Shape(Bitmap bitmap) {
        this.bitmap = bitmap;
        if(bitmap == null) throw new IllegalArgumentException("Shape must have a bitmap");
        if(!isConnected()) throw new IllegalArgumentException("Shape Tiles must be connected");
    }

    public Bitmap getBitmap() {
        return bitmap;
    }

    public boolean isConnected() {
        if(bitmap.getPoints().size() <= 1) return true;
        List<Point> used = new ArrayList<>();
        List<Point> unused = new ArrayList<>(bitmap.getPoints());
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
        return bitmap.getPoints().stream()
        .flatMap(p -> p.getAdjacentPoints().stream())
        .distinct()
        .filter(p -> !bitmap.getPoints().contains(p)).collect(Collectors.toList());
    }

    

    public List<Symmetry> findSymmetriesThatAlign(Bitmap map) {
        return Arrays.stream(Symmetry.values())
        .filter(sym -> map.transform(sym).equals(bitmap)).toList();
    }

    public static void main(String[] args) {
        SQUARE.bitmap.print();
        
        System.out.println(SQUARE.findSymmetriesThatAlign(SQUARE.bitmap.rotate180()));

        L_SHAPE.bitmap.print();
        System.out.println(L_SHAPE.findSymmetriesThatAlign(L_SHAPE.bitmap.rotate90CW()));

        SMALL_L_SHAPE.bitmap.print();
        System.out.println(SMALL_L_SHAPE.findSymmetriesThatAlign(SMALL_L_SHAPE.bitmap.rotate180()));
    }

    public static final Shape SQUARE = new Shape(new Bitmap(new boolean[][]{{true, true}, {true, true}}));
    public static final Shape L_SHAPE = new Shape(new Bitmap(new boolean[][] {{true,false},{true,false},{true,true}}));
    public static final Shape SMALL_L_SHAPE = new Shape(new Bitmap(new boolean[][] {{true,false},{true,true}}));

}