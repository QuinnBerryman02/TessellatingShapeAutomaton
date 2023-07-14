package src;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import java.util.function.BinaryOperator;
import java.util.function.Function;

import java.lang.reflect.Array;
import java.awt.Color;

import src.GeometryUtil.*;

public class Util {
    public static class Pair<A,B> {
        A a;
        B b;

        public Pair(A a, B b) {
            this.a = a;
            this.b = b;
        }

        @Override
        public String toString() {
            return "(" + a.toString() + "," + b.toString() + ")";
        }

        @Override
        @SuppressWarnings("unchecked")
        public boolean equals(Object obj) {
            try {
                Pair<A,B> pair = getClass().cast(obj);
                return a.equals(pair.a) && b.equals(pair.b);
            } catch (ClassCastException e) {
                return false;
            }
        }

        @Override
        public int hashCode() {
            return a.hashCode() * b.hashCode();
        }
    }

    public static class Triple<A,B,C> {
        A a;
        B b;
        C c;

        public Triple(A a, B b, C c) {
            this.a = a;
            this.b = b;
            this.c = c;
        }

        @Override
        public String toString() {
            return "(" + a.toString() + "," + b.toString() + "," + c.toString() + ")";
        }
    }
    static final float ERR = 0.00001f;
    static boolean floatCompare(float a, float b) {
        return Math.abs(a - b) < ERR;
    }

    static boolean zeroOrNeg(float f) {
        return f <= 0 || floatCompare(f, 0f);
    }
    static boolean zeroOrPos(float f) {
        return f >= 0 || floatCompare(f, 0f);
    }

    public static class Matrix<E> {
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

        public Point pointAfterTransformation(Point p, Symmetry transformation) {
            return switch(transformation) {
                case IDENTITY -> new Point( p.x(),                p.y());
                case ROT_90 -> new Point(   height - p.y()- 1,    p.x());
                case ROT_180 -> new Point(  width - p.x()- 1,     height - p.y()- 1);
                case ROT_270 -> new Point(  p.y(),                width - p.x()- 1);
                case FLIP_X -> new Point(   width - p.x()- 1,     p.y());
                case FLIP_Y -> new Point(   p.x(),                height - p.y()- 1);
                case DIAG_TR -> new Point(  height - p.y()- 1,    width - p.x()- 1);
                case DIAG_TL -> new Point(  p.y(),                p.x());
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

    static class PermutationGroup {
        List<Permutation> permutations = new ArrayList<>();
        Map<Permutation, String> labelMap = new HashMap<>(); 
        private Permutation identity = null;
        private int order;

        //the first permutation is assumed to be the identity
        public PermutationGroup(int... permutations) {
            order = permutations.length;
            for (int p : permutations) {
                this.permutations.add(new Permutation(p));
            }
            if(order != 0) this.identity = this.permutations.get(0);
            
        }

        public void setLabels(String... labels) {
            int i=0;
            for (String string : labels) {
                labelMap.put(permutations.get(i++), string);
            }
        }

        public boolean validIdentity() {
            if(identity == null) return false;
            return permutations.stream().allMatch(p -> p.multiply(identity).equals(p));
        }

        public boolean closed() {
            for(var p1 : permutations) {
                for(var p2 : permutations) {
                    if(!permutations.contains(p1.multiply(p2))) return false;
                }
            }
            return true;
        }

        public int getOrder() {
            return order;
        }

        public Permutation getIdentity() {
            return identity;
        }

        public Matrix<Permutation> generateCayleyTable() {
            Matrix<Permutation> mat = new Matrix<Util.Permutation>(getOrder(), getOrder(), Permutation.class);
            mat.setorator((i, j) -> {
                return permutations.get(j).multiply(permutations.get(i));
            });
            mat.setStringMap(p -> labelMap.get(p));
            return mat;
        }

        public List<PermutationGroup> findProperSubGroups() {
            List<Integer> primeFactors = primeFactors(order);
            return null;
        }
    }

    static class Permutation {
        private short n;
        private List<Cycle> cycleDecomposition = new ArrayList<>();

        public Permutation(int permutation) {
            short[] changedIndices = intToShortArray(permutation);
            n = (short)changedIndices.length;
            for(short i=1;i<=n;i++) {
                short newI = changedIndices[i-1];
                if(newI == -1) continue; //already checked
                changedIndices[i-1] = -1;
                if(newI == i) continue; //no change
                List<Short> cycleIndices = new ArrayList<>();
                cycleIndices.add(i);
                do {
                    short currentI = newI;
                    cycleIndices.add(currentI);
                    newI = changedIndices[currentI-1];
                    changedIndices[currentI-1] = -1;
                } while(newI != -1 && newI != i);
                cycleDecomposition.add(new Cycle(cycleIndices));
            }
        }

        public List<Cycle> getCycleDecomposition() {
            return cycleDecomposition;
        }

        public short apply(short s) {
            return cycleDecomposition.stream().reduce(s, (acc, cycle) -> cycle.apply(acc), (a, b) -> b);
        }
        //ans = p ∘ this, ie this first then p
        public Permutation multiply(Permutation p) {
            short[] map = new short[n];
            for(short i=1;i<=n;i++) {
                map[i-1] = p.apply(apply(i)); 
            }
            return new Permutation(shortArrayToInt(map));
        }

        @Override
        public String toString() {
            if(cycleDecomposition.isEmpty()) return "ID";
            String s = "";
            for (Cycle cycle : cycleDecomposition) {
                s += cycle.toString();
            }
            return s;
        }

        @Override
        public boolean equals(Object obj) {
            if(!(obj instanceof Permutation p)) return false;
            return this.cycleDecomposition.containsAll(p.cycleDecomposition) && this.n == p.n;
        }

        @Override
        public int hashCode() {
            return cycleDecomposition.stream().reduce(1, (acc, c) -> 10 * (acc + c.hashCode()), (a, b) -> b);
        }
    }

    static class Cycle {
        private Map<Short, Short> map = new HashMap<>();
        private short n;
        private short first;
        public Cycle(List<Short> indices) {
            this.n = (short)indices.size();
            this.first = indices.get(0);
            for(short i=0;i<n;i++) {
                map.put(indices.get(i),indices.get((i+1) % n));
            }
        }

        public int getLength() {
            return n;
        }

        public short apply(short i) {
            return map.getOrDefault(i, i);
        }

        public List<Short> getOrderedList() {
            List<Short> indices = new ArrayList<>();
            short index = first;
            do {
                indices.add(index);
                index = map.get(index);
            } while (index != first);
            return indices;
        }

        @Override
        public String toString() {
            String s = "(";
            int i=1;
            for(short sh : getOrderedList()) {
                s += sh + (i++==n ? "" : ",");
            }
            return s + ")";
        }

        @Override
        public boolean equals(Object obj) {
            if(!(obj instanceof Cycle c)) return false;
            return this.map.equals(c.map);
        }

        @Override
        public int hashCode() {
            return map.entrySet().stream().reduce(1, (acc, c) -> 10 * (acc + c.hashCode()), (a, b) -> b);
        }
    }

    public static short[] intToShortArray(int i) {
        i = Math.abs(i);
        int digits = Integer.toString(i).length();
        short[] spreadOutDigits = new short[digits];
        for (int j = digits-1; j >= 0; j--) {
            spreadOutDigits[j] = (short)(i % 10);
            i /= 10;
        }
        return spreadOutDigits;
    }

    public static int shortArrayToInt(short[] arr) {
        int i = 0;
        int digits = arr.length;
        for (int j = digits-1; j >= 0; j--) {
            i += arr[j] * Math.pow(10, digits - j - 1); 
        }
        return i;
    } 

    public static List<Integer> primeFactors(int n) {
        List<Integer> factors = new ArrayList<>();
        for(int i=2;i<=n;i++) {
            if(n % i == 0) {
                factors.add(i);
                n /= i;
                i--;
            }
        }
        return factors;
    }

    public static List<Integer> divisors(int n) {
        var primeFactors = primeFactors(n);
        Map<Integer, Integer> primePowers = new HashMap<>();
        primeFactors.forEach(pf -> {
            primePowers.compute(pf, (k, v) -> (v == null) ? 1 : v + 1);
        });
        List<List<Integer>> listOfPowerLists = new ArrayList<>();
        primePowers.forEach((pf,maxPower) -> {
            List<Integer> possiblePowers = new ArrayList<>();
            for(int i=0;i<=maxPower;i++) {
                possiblePowers.add(pow(pf, i));
            }
            listOfPowerLists.add(possiblePowers);
        });
        System.out.println(listOfPowerLists);
        return multiplex(listOfPowerLists, 1, (a,b)->a*b);
    }
    //takes a list of lists, and returns a list of ntuples reduced with an op, made of 1 element from each list 
    public static <E> List<E> multiplex(List<List<E>> listOfLists, E identity ,BinaryOperator<E> op) {
        int[] totals = listOfLists.stream().mapToInt(List::size).toArray();
        int listCount = listOfLists.size(); 
        int[] index = new int[totals.length];
        List<E> newElements = new ArrayList<>();
        while(true) {
            //add divisor
            INCR li = new INCR();
            newElements.add(listOfLists.stream()
            .map(l -> l.get(index[li.incr()]))
            .reduce(identity, op));
            //increment index
            boolean allOverFlow = true;
            for(int i=0;i<listCount;i++) {
                if(++index[i] == totals[i]) index[i] = 0;
                else {allOverFlow = false; break;}
            }
            if(allOverFlow) break;
        }
        return newElements;
    }

    public static int pow(int a, int b) {
        int total = 1;
        for(int n=0;n<b;n++) total*=a;
        return total;
    } 

    public static class INCR {int i=0;int incr() {return i++;}}
 
    public static void main(String[] args) {
        PermutationGroup dihedral4 = new PermutationGroup(1234,2341,3412,4123,2143,4321,3214,1432);
        dihedral4.setLabels("ID","90","18","27","FX","FY","TR","TL");
        dihedral4.generateCayleyTable().print();
        System.out.println(divisors(546));
    }

    
}