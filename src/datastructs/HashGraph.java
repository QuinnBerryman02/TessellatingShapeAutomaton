package src.datastructs;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.function.Function;

public class HashGraph<K1,K2,V> {
    private Function<KeyPair,List<KeyPair>> neighbourFunction;
    private Map<K1, Cluster> map = new HashMap<>();

    public HashGraph() { }

    public void setNeighbourFunction(Function<KeyPair,List<KeyPair>> neighbourFunction) {
        this.neighbourFunction = neighbourFunction;
    }

    public HashGraph<K1,K2,V>.Cluster.Node put(K1 key1, K2 key2, V value) {
        Cluster cluster = map.computeIfAbsent(key1, Cluster::new);
        HashGraph<K1,K2,V>.Cluster.Node node = cluster.new Node(key2, value);
        cluster.addNode(key2, node);
        return node;
    }

    public HashGraph<K1,K2,V>.Cluster.Node put(KeyPair kp, V value) {
        return put(kp.key1, kp.key2, value);
    }

    public HashGraph<K1,K2,V>.Cluster.Node get(K1 key1, K2 key2) {
        Cluster cluster = map.get(key1);
        if(cluster == null) return null;
        return cluster.nodes.get(key2);
    }
    public HashGraph<K1,K2,V>.Cluster.Node get(KeyPair kp) {
        return get(kp.key1, kp.key2);
    }

    public boolean isPresent(KeyPair kp) {return get(kp) != null; }

    @Override
    public String toString() {
        return "(" + map + ")";
    }

    public void unvisitAll() {
        map.values().forEach(c -> {
            c.nodes.values().forEach(n -> {
                n.visited = false;
            });
        });
    }

    public int sizeFrom(HashGraph<K1,K2,V>.Cluster.Node start) {
        return traverse(start).size();
    }

    public List<HashGraph<K1,K2,V>.Cluster.Node> traverse(HashGraph<K1,K2,V>.Cluster.Node start) {
        List<HashGraph<K1,K2,V>.Cluster.Node> nodesFound = new ArrayList<>();
        Queue<HashGraph<K1,K2,V>.Cluster.Node> queue = new LinkedList<>();
        queue.add(start);
        start.visited = true;
        while(!queue.isEmpty()) {
            var node = queue.remove();
            nodesFound.add(node);
            queue.addAll(node.getUnvisitedNeighbours());
        }
        unvisitAll();
        return nodesFound;
    }

    public class Cluster {
        private K1 key;
        private Map<K2, Node> nodes = new HashMap<>();

        private Cluster(K1 key) {
            this.key = key;
        }

        public K1 getKey() {
            return key;
        }

        public Map<K2, Node> getNodes() {
            return nodes;
        }

        private void addNode(K2 key, Node n) {
            nodes.put(key, n);
        }

        @Override
        public String toString() {
            return "(" + nodes + ")";
        }

        public class Node {
            private K2 key;
            private V value;
            private boolean visited = false;
    
            private Node(K2 key, V value) {
                this.key = key;
                this.value = value;
            }

            public List<KeyPair> neighbourKeyPairs() {
                return neighbourFunction.apply(getKeyPair());
            }
            //gets the nodes neighbours, or null if they arent present
            public List<Node> getNeighbours() {
                return neighbourKeyPairs()
                .stream().map(HashGraph.this::get).toList();
            }
            //get neighbours that are present
            public List<Node> getPresentNeighbours() {
                return getNeighbours().stream().filter(n -> n != null).toList();
            }
            //get neighbours that are present and not visited, and set them to visited
            private List<Node> getUnvisitedNeighbours() {
                return getNeighbours().stream().filter(n -> {
                    if(n == null || n.visited) return false;
                    return (n.visited = true);
                }).toList();
            }
            //creates all non present neighbours of a node with starting value v
            public void createNeighbours(V value) {
                neighbourKeyPairs().stream().filter(kp -> !isPresent(kp)).forEach(kp -> put(kp, value));
            }
    
            public V getValue() {
                return value;
            }
    
            public K2 getKey() {
                return this.key;
            }
            public KeyPair getKeyPair() {
                return new KeyPair(Cluster.this.key, this.key);
            }
    
            public Cluster getCluster() {
                return Cluster.this;
            }

            @Override
            public String toString() {
                return "{" + value + "}";
            }
        }
    }

    public class KeyPair {
        public K1 key1;
        public K2 key2;

        public KeyPair(K1 key1, K2 key2) {
            this.key1 = key1;
            this.key2 = key2;
        }

        @Override
        public String toString() {
            return "<" + key1 + "|" + key2 + ">";
        }
    }
}