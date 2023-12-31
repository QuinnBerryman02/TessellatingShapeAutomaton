package src.datastructs;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;

import src.util.GeometryUtil.*;
import src.util.Grouping.Permutation;
import static src.util.Grouping.D4;

import java.lang.reflect.Array;
import java.awt.Color;

public class Matrix<E> {
    private E[][] data;
    private int width;
    private int height;
    private Function<E, Color> colorMap;
    private Function<E, String> stringMap = Object::toString;

    public Matrix(E[][] data) {
        this.width = data[0].length;
        this.height = data.length;
        this.data = data;
    }

    public void setColorMap(Function<E, Color> colorMap) {
        this.colorMap = colorMap;
    }

    public void setStringMap(Function<E, String> stringMap) {
        this.stringMap = stringMap;
    }

    @SuppressWarnings("unchecked")
    public Matrix(int width, int height, Class<?> clazz) {
        this((E[][])Array.newInstance(clazz, height, width));
    }

    public Matrix(int width, int height, E initValue) {
        this(width, height, initValue.getClass());
        setInitialValues(initValue);
    }

    public int getWidth() {
        return width;
    }

    public void setInitialValues(E value) {
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                data[i][j] = value;
            }
        }
    }

    public int getHeight() {
        return height;
    }

    public E[][] getData() {
        return data;
    }

    public E get(int i, int j) {
        return data[i][j];
    }

    public void set(int i, int j, E value) {
        data[i][j] = value;
    }

    public void setorator(BiFunction<Integer,Integer,E> function) {
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                set(i, j, function.apply(i, j));
            }
        }
    }

    public Matrix<E> xflip() {
        return fliperator(width, height, p -> p.y(), p -> p.x(), p -> p.y(), p -> width - p.x()- 1);
    }

    public Matrix<E> yflip() {
        return fliperator(width, height, p -> p.y(), p -> p.x(), p -> height - p.y()- 1, p -> p.x());
    }

    public Matrix<E> rotate90CW() {
        return fliperator(height, width, p -> p.x(), p -> height - p.y()- 1, p -> p.y(), p -> p.x());
    }

    public Matrix<E> rotate90CCW() {
        return fliperator(height, width, p -> width - p.x()- 1, p -> p.y(), p -> p.y(), p -> p.x());
    }

    public Matrix<E> rotate180() {
        return fliperator(width, height, p -> p.y(), p -> p.x(), p -> height - p.y()- 1, p -> width - p.x()- 1);
    }

    public Matrix<E> flipDiagTR() {
        return xflip().rotate90CW();
    }

    public Matrix<E> flipDiagTL() {
        return yflip().rotate90CW();
    }

    public Matrix<E> transform(Permutation permutation) {
        return switch(D4.getLabel(permutation)) {
            default -> this;
            case "ID" -> this;
            case "90" -> rotate90CW();
            case "18" -> rotate180();
            case "27" -> rotate90CCW();
            case "FX" -> xflip();
            case "FY" -> yflip();
            case "TR" -> flipDiagTR();
            case "TL" -> flipDiagTL();
        };
    }

    public Rect toRect() {
        return new Rect(0,0,width,height);
    }

    @SuppressWarnings("unchecked")
    public Matrix<E> fliperator(int w, int h, Function<Point,Integer> newY, Function<Point,Integer> newX, Function<Point,Integer> oldY, Function<Point,Integer> oldX) {
        E[][] newData = (E[][])Array.newInstance(data[0][0].getClass(), h, w);
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                Point p = new Point(j, i);
                newData[newY.apply(p)][newX.apply(p)] = data[oldY.apply(p)][oldX.apply(p)];
            }
        }
        Matrix<E> newMat = new Matrix<>(newData);
        newMat.setColorMap(colorMap);
        newMat.setStringMap(stringMap);
        return newMat;
    }

    public void print() {
        print(stringMap);
    }

    public void print(Function<E, String> customToString) {
        int maxChars = toList().stream().map(customToString).mapToInt(String::length).max().orElse(0);
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                E e = data[i][j];
                String str = customToString.apply(e);
                String padding = " ".repeat(maxChars - str.length());
                if(colorMap == null) System.out.print(str + padding + " ");
                else System.out.print(colorToAsciiCode(colorMap.apply(e)) + str + padding + " " + colorReset());
            }
            System.out.println();
        }
    }

    private static String colorToAsciiCode(Color c) {
        return "\033[97;48;2;" + c.getRed() + ";" + c.getGreen() + ";" + c.getBlue() + "m";
    }

    private static String colorReset() {
        return "\033[0m";
    }

    public List<Point> findAllMatches(E value) {
        List<Point> found = new ArrayList<>();
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                if(get(i, j).equals(value)) found.add(new Point(j, i));
            }
        }
        return found;
    }

    public Point pointAfterPermutation(Point p, Permutation permutation) {
        return switch(D4.getLabel(permutation)) {
            default -> null;
            case "ID" -> new Point(p.x(),                p.y());
            case "90" -> new Point(height - p.y()- 1,    p.x());
            case "18" -> new Point(width - p.x()- 1,     height - p.y()- 1);
            case "27" -> new Point(p.y(),                width - p.x()- 1);
            case "FX" -> new Point(width - p.x()- 1,     p.y());
            case "FY" -> new Point(p.x(),                height - p.y()- 1);
            case "TR" -> new Point(height - p.y()- 1,    width - p.x()- 1);
            case "TL" -> new Point(p.y(),                p.x());
        };
    }

    public List<E> toList() {
        List<E> list = new ArrayList<>();
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                list.add(get(i, j));
            }
        }
        return list;
    }

    @Override
    public boolean equals(Object obj) {
        if(!(obj instanceof Matrix<?> mat2)) return false;
        try {
            for (int i = 0; i < height; i++) {
                for (int j = 0; j < width; j++) {
                    if(!data[i][j].equals(mat2.get(i, j))) return false;
                }
            }
        } catch(Exception e) {
            return false;
        }
        return true;
    }
}
