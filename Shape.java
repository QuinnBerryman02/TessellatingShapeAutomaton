import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

public class Shape {
    private List<Point> points;

    public Shape(List<Point> points) {
        this.points = points;
        if(!isConnected()) throw new IllegalArgumentException("Shape Tiles must be connected");
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

    public List<Edge> findEdges() {
        return points.stream()
        .flatMap(p -> p.getEdgesFromPointSquare().stream())
        .distinct()
        .filter(e -> !points.containsAll(e.twoTiles())).toList();
    }

    public List<Point> findBorderPoints() {
        return points.stream()
        .flatMap(p -> p.getAdjacentPoints().stream())
        .distinct()
        .filter(p -> !points.contains(p)).collect(Collectors.toList());
    }

    public void print() {
        int maxX = points.stream().mapToInt(Point::x).max().orElse(0);
        int maxY = points.stream().mapToInt(Point::y).max().orElse(0);
        int minX = points.stream().mapToInt(Point::x).min().orElse(0);
        int minY = points.stream().mapToInt(Point::y).min().orElse(0);
        boolean[][] mat = new boolean[maxY+minY+1][maxX+minY+1];
        points.forEach(p -> {
            mat[p.y()-minY][p.x()-minX] = true;
        });
        
        for (int i = 0; i < mat.length; i++) {
            for (int j = 0; j < mat[0].length; j++) {
                boolean tile = mat[i][j];
                System.out.print(tile ? "#" : " ");
            }
            System.out.println();
        }
    }

    public void printBorderTiles() {
        List<Point> borderTiles = findBorderPoints();
        int maxX = borderTiles.stream().mapToInt(Point::x).max().orElse(0);
        int maxY = borderTiles.stream().mapToInt(Point::y).max().orElse(0);
        int minX = borderTiles.stream().mapToInt(Point::x).min().orElse(0);
        int minY = borderTiles.stream().mapToInt(Point::y).min().orElse(0);
        boolean[][] mat = new boolean[maxY-minY+1][maxX-minY+1];
        borderTiles.forEach(p -> {
            mat[p.y()-minY][p.x()-minX] = true;
        });
        
        for (int i = 0; i < mat.length; i++) {
            for (int j = 0; j < mat[0].length; j++) {
                boolean tile = mat[i][j];
                System.out.print(tile ? "@" : " ");
            }
            System.out.println();
        }
    }

    public static void main(String[] args) {
        Shape square = new Shape(List.of(
            new Point(0, 0),
            new Point(0, 1), 
            new Point(1, 0),
            new Point(1, 1)));
        System.out.println(square.findEdges().size());
        square.print();
        square.printBorderTiles();

        Shape jagged = new Shape(List.of(
            new Point(0, 0),
            new Point(0, 1), 
            new Point(1, 1),
            new Point(1, 2),
            new Point(2, 2)));
        
        System.out.println(jagged.findEdges().size());
        jagged.print();
        jagged.printBorderTiles();

        Shape crazy = new Shape(List.of(
            new Point(0, 0),
            new Point(0, 1), 
            new Point(1, 1),
            new Point(1, 2),
            new Point(2, 2),
            new Point(3, 2),
            new Point(3, 1),
            new Point(3, 0),
            new Point(2, 3)));
        
        System.out.println(crazy.findEdges().size());
        crazy.print();
        crazy.printBorderTiles();
    }
}

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

    public List<Edge> getEdgesFromPointSquare() {
        return List.of(new Edge(this, right()),
        new Edge(right(), right().down()),
        new Edge(right().down(), down()),
        new Edge(down(), this));
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
record Edge(Point a, Point b) {
    public List<Point> twoTiles() {
        if(a.x() == b.x()) { //vertical edge
            int x = a.x();
            int y = Math.min(a.y(), b.y());
            return List.of(new Point(x - 1, y), new Point(x, y));
        } else { //horizontal edge
            int y = a.y();
            int x = Math.min(a.x(), b.x());
            return List.of(new Point(x, y - 1), new Point(x, y));
        }
    }
    @Override
    public boolean equals(Object other) {
        if(!(other instanceof Edge e)) return false;
        return (a.equals(e.a) && b.equals(e.b)) 
        || (a.equals(e.b) && b.equals(e.a));
    }

    @Override 
    public int hashCode() {
        return Objects.hashCode(a.hashCode() * b.hashCode());
    }
    @Override
    public String toString() {
        return "(" + a + "->" + b + ")";
    }
}