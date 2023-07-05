package src;

import src.GeometryUtil.*;

public class RegularTessellation {
    private Shape shape;
    private int[][] mat;
    private int W;
    private int H;
    private Point centerShape;

    public RegularTessellation(Shape shape) {
        this.shape = shape;
        int shapeWidth = shape.getBitmap().getWidth();
        int shapeHeight = shape.getBitmap().getHeight();
        int maxDim = Math.max(shapeWidth, shapeHeight);
        this.W = shapeWidth + 2 * maxDim;
        this.H = shapeHeight + 2 * maxDim;
        this.mat = new int[H][W];
        this.centerShape = new Point(maxDim, maxDim);
        placeBitmap(maxDim, maxDim, shape.getBitmap(), 1);
    }

    private boolean placeBitmap(int x, int y, Bitmap bm, int code) {
        if(x < 0 || x + bm.getWidth() - 1 >= W) return false;
        if(y < 0 || y + bm.getHeight() - 1 >= H) return false;
        //checking if its safe
        for (int i = 0; i < bm.getHeight(); i++) {
            for (int j = 0; j < bm.getWidth(); j++) {
                if(bm.getBitmap()[i][j] && mat[i+y][j+x] != 0) return false;
            }
        }
        //placing
        for (int i = 0; i < bm.getHeight(); i++) {
            for (int j = 0; j < bm.getWidth(); j++) {
                if(bm.getBitmap()[i][j]) mat[i+y][j+x] = code;
            }
        }
        return true;
    }

    public boolean borderTilesOccupied() {
        return shape.findBorderPoints().stream().allMatch(p -> {
            return mat[p.y() + centerShape.y()][p.x() + centerShape.x()] != 0;
        });
    }

    public boolean borderShapesAreRegular() {
        return false;
    }

    public void print() {
        for (int i = 0; i < mat.length; i++) {
            for (int j = 0; j < mat[0].length; j++) {
                System.out.print((mat[i][j] > 9 ? "" : " ") + mat[i][j] + " ");
            }
            System.out.println();
        }
        System.out.println();
    }

    public static void main(String[] args) {
        RegularTessellation regTes = new RegularTessellation(Shape.L_SHAPE);
        regTes.print();

        RegularTessellation regTes2 = new RegularTessellation(Shape.SMALL_L_SHAPE);
        regTes2.placeBitmap(0, 2, Shape.SMALL_L_SHAPE.getBitmap(), 2);
        regTes2.placeBitmap(4, 2, Shape.SMALL_L_SHAPE.getBitmap(), 3);
        regTes2.placeBitmap(1, 1, Shape.SMALL_L_SHAPE.getBitmap().rotate90CW(), 4);
        regTes2.placeBitmap(3, 1, Shape.SMALL_L_SHAPE.getBitmap().rotate90CW(), 5);
        regTes2.placeBitmap(1, 4, Shape.SMALL_L_SHAPE.getBitmap().rotate90CW(), 6);
        System.out.println(regTes2.borderTilesOccupied()); 
        regTes2.placeBitmap(3, 4, Shape.SMALL_L_SHAPE.getBitmap().rotate90CW(), 7);
        System.out.println(regTes2.borderTilesOccupied()); 
        regTes2.print();
    }
}
