package src;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.lang.reflect.Array;
import java.awt.Color;

public class GeometryUtil {
    record Point(int x, int y) {
        public List<Point> findSurroundingPoints() {
            List<Point> points = new ArrayList<>();
            for(int i=y-1;i<=y+1;i++) {
                for (int j=x-1;j<=x+1;j++) {
                    if(i==y && j==x) continue;
                    points.add(new Point(j, i));
                }
            }
            return points;
        }
    
        public List<Point> getAdjacentPoints() {
            return List.of(up(), right(), down(), left());
        }
        
        public Point add(Point p) {
            return new Point(x + p.x, y + p.y);
        }

        public Point sub(Point p) {
            return new Point(x - p.x, y - p.y);
        }

        public Point negate() {
            return new Point(-x,-y);
        }
    
        public Point right() { return new Point(x + 1, y);}
        public Point left() { return new Point(x - 1, y);}
        public Point down() { return new Point(x, y + 1);}
        public Point up() { return new Point(x, y - 1);}
    
        @Override
        public String toString() {
            return "[" + x + "," + y + "]";
        }

    }
    
    record Rect(int x, int y, int width, int height) {
        public static Rect calculateRect(List<Point> points) {
            //need to optimise?
            int maxX = points.stream().mapToInt(Point::x).max().orElse(0);
            int maxY = points.stream().mapToInt(Point::y).max().orElse(0);
            int minX = points.stream().mapToInt(Point::x).min().orElse(0);
            int minY = points.stream().mapToInt(Point::y).min().orElse(0);
            return new Rect(minX, minY, maxX - minX + 1, maxY - minY + 1);
        }

        public boolean inside(Point p) {
            if(p.x < x || p.x >= x + width) return false;
            if(p.y < y || p.y >= y + height) return false;
            else return true;
        }
    }
    
    enum Symmetry {
        IDENTITY,
        ROT_90,
        ROT_180,
        ROT_270,
        FLIP_X,
        FLIP_Y,
        DIAG_TR,
        DIAG_TL;
    
        private static Symmetry[][] applicationTable = {
            {IDENTITY,  ROT_90,     ROT_180,    ROT_270,    FLIP_X,     FLIP_Y,     DIAG_TR,    DIAG_TL},
            {ROT_90,    ROT_180,    ROT_270,    IDENTITY,   DIAG_TL,    DIAG_TR,    FLIP_X,     FLIP_Y},
            {ROT_180,   ROT_270,    IDENTITY,   ROT_90,     FLIP_Y,     FLIP_X,     DIAG_TL,    DIAG_TR},
            {ROT_270,   IDENTITY,   ROT_90,     ROT_180,    DIAG_TR,    DIAG_TL,    FLIP_Y,     FLIP_X},
            {FLIP_X,    DIAG_TR,    FLIP_Y,     DIAG_TL,    IDENTITY,   ROT_180,    ROT_270,    ROT_90},
            {FLIP_Y,    DIAG_TL,    FLIP_X,     DIAG_TR,    ROT_180,    IDENTITY,   ROT_90,     ROT_270},
            {DIAG_TR,   FLIP_Y,     DIAG_TL,    FLIP_X,     ROT_90,     ROT_270,    IDENTITY,   ROT_180},
            {DIAG_TL,   FLIP_X,     DIAG_TR,    FLIP_Y,     ROT_270,    ROT_90,     ROT_180,    IDENTITY},
        };
    
        public Symmetry apply(Symmetry transformation) {
            return applicationTable[this.ordinal()][transformation.ordinal()];
        }
    
        public Symmetry unapply(Symmetry transformation) {
            return applicationTable[this.ordinal()][transformation.inversion().ordinal()];
        }

        public Symmetry inversion() {
            if(this.equals(ROT_90)) return ROT_270;
            if(this.equals(ROT_270)) return ROT_90;
            return this;
        }

        public String simple() {
            return switch(this) {
                case IDENTITY -> "ID";
                case ROT_90 -> "90";
                case ROT_180 -> "18";
                case ROT_270 -> "27";
                case FLIP_X -> "FX";
                case FLIP_Y -> "FY";
                case DIAG_TR -> "TR";
                case DIAG_TL -> "TL";
            };
        }
    }
    
    public static class Matrix<E> {
        private E[][] data;
        private int width;
        private int height;
        private Function<E, Color> colorMap;
    
        public Matrix(E[][] data) {
            this.width = data[0].length;
            this.height = data.length;
            this.data = data;
        }

        public void setColorMap(Function<E, Color> colorMap) {
            this.colorMap = colorMap;
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
    
        public Matrix<E> xflip() {
            return iterator(width, height, p -> p.y, p -> p.x, p -> p.y, p -> width - p.x - 1);
        }
    
        public Matrix<E> yflip() {
            return iterator(width, height, p -> p.y, p -> p.x, p -> height - p.y - 1, p -> p.x);
        }
    
        public Matrix<E> rotate90CW() {
            return iterator(height, width, p -> p.x, p -> height - p.y - 1, p -> p.y, p -> p.x);
        }
    
        public Matrix<E> rotate90CCW() {
            return iterator(height, width, p -> width - p.x - 1, p -> p.y, p -> p.y, p -> p.x);
        }
    
        public Matrix<E> rotate180() {
            return iterator(width, height, p -> p.y, p -> p.x, p -> height - p.y - 1, p -> width - p.x - 1);
        }
    
        public Matrix<E> flipDiagTR() {
            return xflip().rotate90CW();
        }
    
        public Matrix<E> flipDiagTL() {
            return yflip().rotate90CW();
        }
    
        public Matrix<E> transform(Symmetry transformation) {
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

        public Rect toRect() {
            return new Rect(0,0,width,height);
        }

        @SuppressWarnings("unchecked")
        public Matrix<E> iterator(int w, int h, Function<Point,Integer> newY, Function<Point,Integer> newX, Function<Point,Integer> oldY, Function<Point,Integer> oldX) {
            E[][] newData = (E[][])Array.newInstance(data[0][0].getClass(), h, w);
            for (int i = 0; i < height; i++) {
                for (int j = 0; j < width; j++) {
                    Point p = new Point(j, i);
                    newData[newY.apply(p)][newX.apply(p)] = data[oldY.apply(p)][oldX.apply(p)];
                }
            }
            Matrix<E> newMat = new Matrix<>(newData);
            newMat.setColorMap(colorMap);
            return newMat;
        }
    
        public void print() {
            for (int i = 0; i < height; i++) {
                for (int j = 0; j < width; j++) {
                    E e = data[i][j];
                    System.out.print(colorToAsciiCode(colorMap.apply(e)) + e + " " + colorReset());
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
    
        public static void main(String[] args) {
            Matrix<Integer> L = new Matrix<>(new Integer[][] {
                {1,0},
                {1,0},
                {1,1},
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

        public List<Point> findAllMatches(E value) {
            List<Point> found = new ArrayList<>();
            for (int i = 0; i < height; i++) {
                for (int j = 0; j < width; j++) {
                    if(get(i, j).equals(value)) found.add(new Point(j, i));
                }
            }
            return found;
        }

        public Point pointAfterTransformation(Point p, Symmetry transformation) {
            return switch(transformation) {
                case IDENTITY -> new Point( p.x,                p.y);
                case ROT_90 -> new Point(   height - p.y - 1,   p.x);
                case ROT_180 -> new Point(  width - p.x - 1,    height - p.y - 1);
                case ROT_270 -> new Point(  p.y,                width - p.x - 1);
                case FLIP_X -> new Point(   width - p.x - 1,    p.y);
                case FLIP_Y -> new Point(   p.x,                height - p.y - 1);
                case DIAG_TR -> new Point(  height - p.y - 1,   width - p.x - 1);
                case DIAG_TL -> new Point(  p.y,                p.x);
            };
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

    
}