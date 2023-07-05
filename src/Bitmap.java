package src;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import src.GeometryUtil.*;

public class Bitmap {
    private boolean[][] bitmap;
    private List<Point> points;
    private int width;
    private int height;

    public Bitmap(boolean[][] bitmap) {
        this.width = bitmap[0].length;
        this.height = bitmap.length;
        this.bitmap = bitmap;
        this.points = new ArrayList<Point>();
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                if(bitmap[i][j]) points.add(new Point(j, i));
            }
        }
    }

    public Bitmap(List<Point> points) {
        Rect rect = Rect.calculateRect(points);
        this.width = rect.width();
        this.height = rect.height();
        this.bitmap = new boolean[height][width];
        this.points = points.stream().map(p -> new Point(p.x()-rect.x(), p.y()-rect.y())).toList(); //recenter at origin
        this.points.forEach(p -> {
            bitmap[p.y()][p.x()] = true;
        });
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public List<Point> getPoints() {
        return points;
    }

    public boolean[][] getBitmap() {
        return bitmap;
    }

    public Bitmap xflip() {
        return iterator(width, height, p -> p.i, p -> p.j, p -> p.i, p -> width - p.j - 1);
    }

    public Bitmap yflip() {
        return iterator(width, height, p -> p.i, p -> p.j, p -> height - p.i - 1, p -> p.j);
    }

    public Bitmap rotate90CW() {
        return iterator(height, width, p -> p.j, p -> height - p.i - 1, p -> p.i, p -> p.j);
    }

    public Bitmap rotate90CCW() {
        return iterator(height, width, p -> width - p.j - 1, p -> p.i, p -> p.i, p -> p.j);
    }

    public Bitmap rotate180() {
        return iterator(width, height, p -> p.i, p -> p.j, p -> height - p.i - 1, p -> width - p.j - 1);
    }

    public Bitmap flipDiagTR() {
        return xflip().rotate90CW();
    }

    public Bitmap flipDiagTL() {
        return yflip().rotate90CW();
    }

    public Bitmap transform(Symmetry transformation) {
        return switch(transformation) {
            case IDENTITY -> this;
            case ROT_90 -> rotate90CW();
            case ROT_180 -> rotate180();
            case ROT_270 -> rotate90CCW();
            case FLIP_X -> xflip();
            case FLIP_Y -> yflip();
            case DIAG_TR -> flipDiagTR();
            case DIAG_TL -> flipDiagTL();
        };
    }

    public Bitmap iterator(int w, int h, Function<Pair,Integer> newY, Function<Pair,Integer> newX, Function<Pair,Integer> oldY, Function<Pair,Integer> oldX) {
        boolean[][] newBitmap = new boolean[h][w];
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                Pair p = new Pair(i, j);
                newBitmap[newY.apply(p)][newX.apply(p)] = bitmap[oldY.apply(p)][oldX.apply(p)];
            }
        }
        return new Bitmap(newBitmap);
    }

    public void print() {
        for (int i = 0; i < bitmap.length; i++) {
            for (int j = 0; j < bitmap[0].length; j++) {
                boolean tile = bitmap[i][j];
                System.out.print(tile ? "#" : " ");
            }
            System.out.println();
        }
        System.out.println();
    }

    record Pair(int i, int j) {};

    public static void main(String[] args) {
        Bitmap L = new Bitmap(new boolean[][] {
            {true,false},
            {true,false},
            {true,true},
        });
        L.print();
        L.rotate90CW().print();
        L.rotate180().print();
        L.rotate90CCW().print();
        L.xflip().print();
        L.yflip().print();
        L.flipDiagTR().print();
        L.flipDiagTL().print();

    }

    @Override
    public boolean equals(Object obj) {
        if(!(obj instanceof Bitmap b)) return false;
        return points.containsAll(b.points) && b.points.size() == points.size();
    }
}