package src.util;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BinaryOperator;

import src.datastructs.*;

public class Grouping {
    public static Dihedral4 D4 = new Dihedral4();

    public static class Dihedral4 extends Group<Permutation> {
        public Permutation ID;
        public Dihedral4() {
            super(List.of(1234,2341,3412,4123,2143,4321,3214,1432)
            .stream().map(Permutation::new).toList(), Permutation.OP);
            setLabels("ID","90","18","27","FX","FY","TR","TL");
            ID = identity;
        }

        public Permutation apply(Permutation p1, Permutation p2) {
            return p1.multiply(p2);
        }

        public Permutation unapply(Permutation p1, Permutation p2) {
            return p1.multiply(getInverse(p2));
        }
        
        public String getLabel(Permutation p) {
            return labelMap.get(p);
        }

        public List<Permutation> getPermutations() {
            return elements;
        }

        public Permutation get(String label) {
           return labelMap.entrySet().stream()
           .filter(e -> e.getValue().equals(label))
           .findFirst().orElse(null).getKey();
        }
    }

    public static class Group<E> {
        protected List<E> elements = new ArrayList<>();;
        protected BinaryOperator<E> operator;
        protected Map<E, String> labelMap = new HashMap<>();
        protected Map<E, E> inverseMap = new HashMap<>();
        protected E identity = null;
        protected int order;

        public Group(List<E> elements, BinaryOperator<E> operator) {
            order = elements.size();
            this.elements = elements;
            this.operator = operator;
            if(order != 0) this.identity = this.elements.get(0);
            findAllInverses();
        }

        public void findAllInverses() {
            elements.stream().forEach(e1 -> {
                elements.stream().forEach(e2 -> {
                    if(operator.apply(e1, e2).equals(identity)
                    && operator.apply(e2, e1).equals(identity)) {
                        inverseMap.put(e1, e2);
                    }
                });
                inverseMap.putIfAbsent(e1, null);
            });
        }

        public void setLabels(String... labels) {
            int i=0;
            for (String string : labels) {
                labelMap.put(elements.get(i++), string);
            }
        }

        //not checking for association
        public boolean isValidGroup() {
            return hasInverses() && validIdentity() && closed();
        }

        public boolean hasInverses() {
            return inverseMap.containsValue(null);
        }

        public boolean validIdentity() {
            if(identity == null) return false;
            return elements.stream().allMatch(e -> operator.apply(e, identity).equals(e));
        }

        public boolean closed() {
            for(var e1 : elements) {
                for(var e2 : elements) {
                    if(!elements.contains(operator.apply(e1, e2))) return false;
                }
            }
            return true;
        }

        public int getOrder() {
            return order;
        }

        public E getIdentity() {
            return identity;
        }

        public Matrix<E> generateCayleyTable() {
            Matrix<E> mat = new Matrix<>(getOrder(), getOrder(), identity.getClass());
            mat.setorator((i, j) -> {
                //System.out.println(elements.get(i) + " x " + elements.get(j) + " = " + operator.apply(elements.get(j), elements.get(i)));
                return operator.apply(elements.get(j), elements.get(i));
            });
            mat.setStringMap(e -> labelMap.getOrDefault(e, "??"));
            return mat;
        }

        public List<Group<E>> findProperSubGroups() {
            List<Group<E>> subGroups = new ArrayList<>();
            List<Integer> potentialOrders = NumberUtil.divisors(order); //by lagranges theorem
            potentialOrders.remove((Integer)1);             //remove the trivial group
            potentialOrders.remove((Integer)order);         //remove the original group
            for (int potentialOrder : potentialOrders) {
                int elementsToChoose = potentialOrder-1;    //remove identity, has to be in it
                List<List<E>> potentialElementLists = Util.kcombinations(Util.cdr(elements), elementsToChoose);
                potentialElementLists.forEach(l -> l.add(identity));
                for (List<E> elementList : potentialElementLists) {
                    Group<E> subgroup = new Group<>(elementList, operator);
                    subgroup.setLabelMap(labelMap);
                    if(subgroup.closed()) subGroups.add(subgroup);
                }
            }
            return subGroups;
        }

        public E getInverse(E element) {
            return inverseMap.get(element);
        }

        @Override
        public String toString() {
            return elements.stream().map(labelMap::get).toList().toString();
        }

        public void setLabelMap(Map<E, String> labelMap) {
            labelMap.forEach((e,l) -> {
                if(elements.contains(e)) this.labelMap.put(e, l);
            });
        }
    }

    public static class Permutation {
        public final static BinaryOperator<Permutation> OP = (a,b) -> a.multiply(b);
        private short n;
        private List<Cycle> cycleDecomposition = new ArrayList<>();
        private int code;

        public Permutation(int permCode) {
            this.code = permCode;
            short[] changedIndices = NumberUtil.intToShortArray(permCode);
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
            return new Permutation(NumberUtil.shortArrayToInt(map));
        }

        public int getCode() {
            return code;
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
            return this.cycleDecomposition.containsAll(p.cycleDecomposition) && (cycleDecomposition.size() == p.cycleDecomposition.size());
        }

        @Override
        public int hashCode() {
            return cycleDecomposition.stream().reduce(1, (acc, c) -> 10 * (acc + c.hashCode()), (a, b) -> b);
        }
    }

    public static class Cycle {
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

    public static void main(String[] args) {
       D4.generateCayleyTable().print();
       D4.findProperSubGroups().forEach(sg -> sg.generateCayleyTable().print());
    }
}
