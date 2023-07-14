package src.util;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import src.datastructs.*;

public class Grouping {
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

        public PermutationGroup(List<Permutation> permutations) {
            order = permutations.size();
            this.permutations = permutations;
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
            Matrix<Permutation> mat = new Matrix<Permutation>(getOrder(), getOrder(), Permutation.class);
            mat.setorator((i, j) -> {
                // System.out.println(permutations.get(i) + " x " + permutations.get(j) + " = " + permutations.get(j).multiply(permutations.get(i)));
                return permutations.get(j).multiply(permutations.get(i));
            });
            mat.setStringMap(p -> labelMap.getOrDefault(p, "??"));
            return mat;
        }

        public List<PermutationGroup> findProperSubGroups() {
            List<PermutationGroup> subGroups = new ArrayList<>();
            List<Integer> potentialOrders = NumberUtil.divisors(order); //by lagranges theorem
            potentialOrders.remove((Integer)1);             //remove the trivial group
            potentialOrders.remove((Integer)order);         //remove the original group
            for (int potentialOrder : potentialOrders) {
                int elementsToChoose = potentialOrder-1;    //remove identity, has to be in it
                List<List<Permutation>> potentialPermutationLists = Util.kcombinations(Util.cdr(permutations), elementsToChoose);
                potentialPermutationLists.forEach(l -> l.add(identity));
                for (List<Permutation> permList : potentialPermutationLists) {
                    PermutationGroup subgroup = new PermutationGroup(permList);
                    subgroup.setLabelMap(labelMap);
                    if(subgroup.closed()) subGroups.add(subgroup);
                }
            }
            return subGroups;
        }

        @Override
        public String toString() {
            return permutations.stream().map(p -> labelMap.get(p)).toList().toString();
        }

        public void setLabelMap(Map<Permutation, String> labelMap) {
            labelMap.forEach((p,l) -> {
                if(permutations.contains(p)) this.labelMap.put(p, l);
            });
        }
    }

    static class Permutation {
        private short n;
        private List<Cycle> cycleDecomposition = new ArrayList<>();

        public Permutation(int permutation) {
            short[] changedIndices = NumberUtil.intToShortArray(permutation);
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

    public static void main(String[] args) {
        PermutationGroup dihedral4 = new PermutationGroup(1234,2341,3412,4123,2143,4321,3214,1432);
        dihedral4.setLabels("ID","90","18","27","FX","FY","TR","TL");
        dihedral4.generateCayleyTable().print();
        dihedral4.findProperSubGroups().forEach(sg -> {
            System.out.println();
            sg.generateCayleyTable().print();
        });
    }
}
