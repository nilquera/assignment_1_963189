CREATE KEYSPACE coredms WITH
    replication = {'class': 'NetworkTopologyStrategy',
                    'europe-north1': 2,
                    'europe-west1': 2};
