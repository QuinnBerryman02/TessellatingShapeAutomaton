import java.awt.image.BufferedImage;
import java.awt.*;

public class Plane {
    private BufferedImage image;
    private int width,height;
    
    public Plane(int width, int height) {
        this.width = width;
        this.height = height;
        image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);

        Color[] colors = {Color.red, Color.BLUE, Color.green};
            
        int n = 0;
        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                Color c = colors[n++ % 3];
                image.setRGB(i, j, c.getRGB());
            }
        }
    }

    public BufferedImage getImage() {
        return image;
    }
    
}
