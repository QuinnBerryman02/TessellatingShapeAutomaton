package src;
import java.awt.image.BufferedImage;

import src.Util.*;
import src.GeometryUtil.*;
import src.GeometryUtil.Point;

import java.awt.*;

public class Plane {
    private BufferedImage image;
    private int width,height;
    private static final Color DEF_COLOR = Color.WHITE;
    
    public Plane(int width, int height) {
        this.width = width;
        this.height = height;
        image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                image.setRGB(j, i, DEF_COLOR.getRGB());
            }
        }
        
    }

    public BufferedImage getImage() {
        return image;
    }

    public boolean placeBitmap(Point p, Matrix<Boolean> bm, Color color) {
        int bmw=bm.getWidth(), bmh=bm.getHeight();
        Rect plane = new Rect(0, 0, width - bmw + 1, height - bmh + 1);
        if(!plane.inside(p)) return false;
        //checking if its safe
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                Color c = new Color(image.getRGB(j+p.x(), i+p.y()));
                if(bm.get(i,j) && !c.equals(DEF_COLOR)) return false;
            }
        }
        //placing
        for (int i = 0; i < bmh; i++) {
            for (int j = 0; j < bmw; j++) {
                if(bm.get(i,j)) image.setRGB(j+p.x(), i+p.y(), color.getRGB());
            }
        }
        return true;
    }

    public Point center() {
        return new Point(width / 2, height / 2);
    }
}
