package src;

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
}
