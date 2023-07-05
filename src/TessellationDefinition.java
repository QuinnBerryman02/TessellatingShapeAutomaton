package src;
public class TessellationDefinition {
    private Shape shape;
    private int[][] bitmap;

    public TessellationDefinition(Shape shape) {
        this.shape = shape;
        
    }

    public boolean borderTilesOccupied() {
        return false;
    }

    public boolean noOverlappingTiles() {
        return false;
    }

    public boolean borderShapesAreRegular() {
        return false;
    }
}
