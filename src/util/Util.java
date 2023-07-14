package src.util;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BinaryOperator;

public class Util {
    public static class Pair<A,B> {
        public A a;
        public B b;

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

    public static class INCR {int i=0;int incr() {return i++;}}
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

    //returns all combinations of size k, ie amount = choose (list.size, k)
    public static <E> List<List<E>> kcombinations(List<E> list, int k) {
        if(list.isEmpty()) return new ArrayList<>();
        List<List<E>> combinations = new ArrayList<>();
        if(k == 1) {
            list.forEach(e -> combinations.add(new ArrayList<>(List.of(e))));
            return combinations;
        }
        kcombinations(cdr(list), k-1).forEach(c -> {
            c.add(car(list));
            combinations.add(c);
        });
        kcombinations(cdr(list), k).forEach(combinations::add);
        return combinations;
    }

    public static <E> E car(List<E> list) {
        if(list.isEmpty()) return null;
        return list.get(0);
    }

    public static <E> List<E> cdr(List<E> list) {
        if(list.isEmpty()) return new ArrayList<>();
        return list.subList(1, list.size());
    }
}