package src.util;

import java.util.ArrayList;
import java.util.List;

import src.util.Grouping.Permutation;
import src.util.Util.*;
import static src.util.Grouping.D4;

public class GeometryUtil {
    public record Vector(int vx, int vy) {
        public Point toPoint() {
            return new Point(vx, vy);
        }

        @Override
        public String toString() {
            return "<" + vx + "," + vy + ">";
        }

        public Vector add(Vector v) {
            return new Vector(vx + v.vx, vy + v.vy);
        }

        public Vector sub(Vector v) {
            return new Vector(vx - v.vx, vy - v.vy);
        }
    }

    public record Point(int x, int y) {
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
        
        public Point add(Vector v) {
            return new Point(x + v.vx, y + v.vy);
        }

        public Point sub(Point p) {
            return new Point(x - p.x, y - p.y);
        }

        public Point sub(Vector v) {
            return new Point(x - v.vx, y - v.vy);
        }

        public Point negate() {
            return new Point(-x,-y);
        }

        public int eulerDistance() {
            return Math.abs(x) + Math.abs(y);
        }

        public int non0EulerDistance() {
            return eulerDistance() == 0 ? Integer.MAX_VALUE : eulerDistance();
        }

        public Point scalarMultiplyAndDivide(int mult, int divide) {
            return new Point(x * mult / divide, y * mult / divide);
        }

        public Pair<Float, Float> floatMultiply(float f) {
            return new Pair<>(x * f, y * f);
        }

        public Point matrixMultiply(Vector a, Vector b) {
            return new Point(x * a.vx + y * b.vx, x * a.vy + y * b.vy);
        }

        public static Point fromFloatPair(Pair<Float, Float> p) {
            return new Point((int)Math.floor(p.a) , (int)Math.floor(p.b));
        }

        public Point matrixMultiplyInverse(Vector a, Vector b) {
            int denomDet = a.vx*b.vy - a.vy*b.vx;
            Vector a2 = new Vector(b.vy, -a.vy);
            Vector b2 = new Vector(-b.vx, a.vx);
            return fromFloatPair(matrixMultiply(a2, b2).floatMultiply(1f / denomDet));
        }

        public Line lineBetween(Point q) {
            float A = q.y - y;
            float B = x - q.x;
            float C = (q.x * y) - (x * q.y);
            return new Line(A,B,C);
        }

        public Line toLine() {
            return lineBetween(new Point(0, 0));
        }

        public Point pointOnRight() {
            if(Math.abs(angle() + 0.00001) > Math.PI/2) {
                return negate();
            }
            return this;
        }
        //from positive X axis CCW = -
        public double angle() {
            return Math.atan2(y, x);
        }
    
        public Point right() { return new Point(x + 1, y);}
        public Point left() { return new Point(x - 1, y);}
        public Point down() { return new Point(x, y + 1);}
        public Point up() { return new Point(x, y - 1);}

        public Vector toVector() {
            return new Vector(x, y);
        }
    
        @Override
        public String toString() {
            return "[" + x + "," + y + "]";
        }

        public Point transform(Permutation permutation) {
            return switch(D4.getLabel(permutation)) {
                default -> null;
                case "ID" -> new Point(x, y);
                case "90" -> new Point( -y, x);
                case "18" -> new Point(-x,-y);
                case "27" -> new Point( y,-x);
                case "FX" -> new Point( -x, y);
                case "FY" -> new Point(  x,-y);
                case "TR" -> new Point(-y,-x);
                case "TL" -> new Point( y, x);
            };
        }

        public static Point ORIGIN = new Point(0, 0);

    }

    public record Line(float A, float B, float C) {
        public float eval(float x) {
            return -A/B*x - C/B;
        }
        
        public boolean pointOnLine(Point p) {
            return NumberUtil.floatCompare(A*p.x + B*p.y + C, 0f); 
        }

        public float slope() {
            if(B == 0) return Integer.MAX_VALUE;
            return -A / B;
        }

        public float intercept() {
            if(B == 0) return Integer.MAX_VALUE;
            return -C / B;
        }

        public Pair<Float, Float> intersection(Line l) {
            if(NumberUtil.floatCompare(slope(), l.slope())) return null;
            float x = (-C - B*l.intercept()) / (A + B*l.slope());
            float y = eval(x);
            return new Pair<>(x, y);
        }

        public float signedDistTo(Point p) {
            float denom = (float)Math.sqrt(A*A + B*B);
            float num = A*p.x + B*p.y + C;
            return num / denom;
        }

        @Override
        public String toString() {
            return A + "x + " + B + "y + " + C;
        }
    }

    public static class Parallelogram {
        public Point[] points = new Point[4];
        public Line[] lines = new Line[4];
        private boolean CCW;
        
        public Parallelogram(Vector bv1, Vector bv2) {
            this(Point.ORIGIN, bv1.toPoint(), bv1.add(bv2).toPoint(), bv2.toPoint());
        }
        public Parallelogram(Point a, Point b, Point c, Point d) {
            double ang1 = b.sub(a).angle();
            double ang2 = d.sub(a).angle();
            if(ang1 < ang2) CCW = false;
            else if(ang1 > ang2) CCW = true;
            else throw new IllegalArgumentException("Not a well formed parallelogram");
            points[0] = a;
            points[1] = b;
            points[2] = c;
            points[3] = d;
            for(int i=0;i<4;i++) {
                lines[i] = points[i].lineBetween(points[(i+1)%4]);
            }
        }

        public boolean inside(Point p) {
            float[] distances = new float[4];
            for(int i=0;i<4;i++) {
                distances[i] = lines[i].signedDistTo(p);
            }
            boolean allInside = true;
            for(int i=0;i<4;i++) {
                allInside = allInside && (CCW 
                ? NumberUtil.zeroOrPos(distances[i]) 
                : NumberUtil.zeroOrNeg(distances[i]));
            }
            return allInside;
        }
    }
    
    public record Rect(int x, int y, int width, int height) {
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

    public record Range(int min, int max) {}
    public record DoubleRange(Range r1, Range r2) {}
}