package src;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import src.GeometryUtil.*;

public class Shape {
    private Bitmap bitmap;
    private Symmetry symmetry;

    public Shape(Bitmap bitmap) {
        this.bitmap = bitmap;
        this.symmetry = Symmetry.IDENTITY;
        if(bitmap == null) throw new IllegalArgumentException("Shape must have a bitmap");
        if(!isConnected()) throw new IllegalArgumentException("Shape Tiles must be connected");
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
        Shape square = new Shape(new Bitmap(new boolean[][]{{true, true}, {true, true}}));

        square.bitmap.print();
        
        System.out.println(square.findSymmetriesThatAlign(square.bitmap.rotate180()));

        Bitmap L = new Bitmap(new boolean[][] {
            {true,false},
            {true,false},
            {true,true},
        });
        L.print();
        Shape Lshape = new Shape(L);
        System.out.println(Lshape.findSymmetriesThatAlign(Lshape.bitmap.rotate90CW()));

        Bitmap smallL = new Bitmap(new boolean[][] {
            {true,false},
            {true,true},
        });
        smallL.print();
        Shape smallLShape = new Shape(smallL);
        System.out.println(smallLShape.findSymmetriesThatAlign(smallLShape.bitmap.rotate180()));
    }
}