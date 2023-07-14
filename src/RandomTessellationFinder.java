package src;

import java.util.Random;

import src.util.GeometryUtil.*;
import src.datastructs.*;

public class RandomTessellationFinder {
    private static Random random = new Random(System.nanoTime());
    private DoubleRange doubleRange;

    public RandomTessellationFinder(DoubleRange doubleRange) {
        this.doubleRange = doubleRange;
    }

    public Tessellation randomTessellation() {
        // i dont currently know how to reasonable do this...
        return null;
    }

    public Shape randomShape() {
        Range xRange = doubleRange.r1();
        Range yRange = doubleRange.r2();
        int w = random.nextInt(xRange.max()-xRange.min()+1) + xRange.min();
        int h = random.nextInt(yRange.max()-yRange.min()+1) + yRange.min();
        return randomShape(w, h);
    }

    public Shape randomShape(int w, int h) {
        Shape shape = new Shape(randomBitmap(w, h));
        while(!shape.isConnected() || !shape.wellFitted()) {
            shape = new Shape(randomBitmap(w, h));
        }
        return shape;
    }

    public Matrix<Boolean> randomBitmap(int w, int h) {
        Matrix<Boolean> matrix = new Matrix<>(w, h, false);
        matrix.setorator((i,j) -> random.nextBoolean());
        return matrix;
    }

    public static void main(String[] args) {
        var finder = new RandomTessellationFinder(new DoubleRange(new Range(2, 3), new Range(2, 3)));
        Shape s = finder.randomShape();
        s.getBitmap().print(b -> b ? "#" : ".");
        System.out.println(s.getCenter());
    }
}