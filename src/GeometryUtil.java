package src;

import java.util.ArrayList;
import java.util.List;

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
    }
}
