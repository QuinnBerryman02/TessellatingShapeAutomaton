package src;
import javax.swing.*;

import src.GeometryUtil.Symmetry;
import src.GeometryUtil.Point;

import java.awt.event.*;
import java.awt.*;

public class Window extends JFrame implements MouseListener, MouseMotionListener, MouseWheelListener {  
    DrawPanel panel;
    Plane plane;
    final int PLANE_SIZE = 100;
    final int WINDOW_SIZE = 750;

    public Window() {
        super("Tessellation Shape Automaton");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        addMouseListener(this);
        addMouseMotionListener(this);
        addMouseWheelListener(this);

        panel = new DrawPanel();
        panel.setVisible(true);
        
        setSize(WINDOW_SIZE, WINDOW_SIZE);
        getContentPane().add(panel);
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setVisible(true);

        plane = new Plane(PLANE_SIZE, PLANE_SIZE);

        Tessellation tes = Tessellation.SQUARE_1;
        tes.drawToPlane(plane);
        repaint();
    }

    @Override
    public void mouseClicked(MouseEvent e) {}

    @Override
    public void mouseEntered(MouseEvent e) {}

    @Override
    public void mouseExited(MouseEvent e) {}

    @Override
    public void mouseMoved(MouseEvent e) {}

    @Override
    public void mouseDragged(MouseEvent e) { 
    }

    @Override
    public void mousePressed(MouseEvent e) {
    }

    @Override
    public void mouseReleased(MouseEvent e) {}

    @Override
    public void mouseWheelMoved(MouseWheelEvent e) { 
    }

    class DrawPanel extends JPanel {
        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            g.drawImage(plane.getImage(), 0, 0, getWidth(), getHeight(), null);
        }
    }
}  

