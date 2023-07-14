package src.util;

import java.util.*;

public class NumberUtil {
    public static final float ERR = 0.00001f;

    public static boolean floatCompare(float a, float b) {
        return Math.abs(a - b) < ERR;
    }

    public static boolean zeroOrNeg(float f) {
        return f <= 0 || floatCompare(f, 0f);
    }
    public static boolean zeroOrPos(float f) {
        return f >= 0 || floatCompare(f, 0f);
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
        return Util.multiplex(listOfPowerLists, 1, (a,b)->a*b);
    }

    public static int pow(int a, int b) {
        int total = 1;
        for(int n=0;n<b;n++) total*=a;
        return total;
    } 

    public static int fact(int n) {
        if(n < 0) return 0;
        int total=1;
        for(int i=1;i<=n;i++) total*=i;
        return total;
    }

    public static int choose(int n, int k) {
        return fact(n) / (fact(k) * fact(n-k)); 
    }
}