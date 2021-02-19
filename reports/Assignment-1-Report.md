# Assignment 1 report

In this file we look into the details of my solution for the first assignment. I will answer the questions provided by the course.

# Design

**1. Explain your choice of data and technologies for mysimbdp-coredms.**

I chose the tortoise monitoring data from Korkeasaari ZOO in Helsinki. The reason of this decision is mostly a personal preference. Some years ago I worked in an IoT start-up which had a very weak data flow system and I think the tortoise example is quite aproximate to the kind of data I was working with.

The tortoise data is obtained with RuuviTag, a small monitoring device which captures acceleration, humidity, pressure, temperature, and other environment parameters. The source given to us in the course is from a single RuuviTag. For the sake of the exercice, I will try to create fake data (the data given to us is pretty small).

> NOTE: the script reading RuuviTag is killed once in hour so there is usually 1-2 minute gap in the data in the end of hour.

By the previous statement of the tortoise data readme, we can assume that RuuviTag produces continuous information, but it is only "gathered" when an script is triggered. In the source given to us, there are measurements every 5 minutes approximately. However, since this seems an arbitrary choice, I will assume that any client storing data in our platform will choose his own capture frequency. Also, I will assume that the data is not restricted to tortoises monitoring; instead, it could come from any other animal with monitoring interest. As a result, my platform will have to deal with monitoring logs from different clients and different animals. If we had, for example, one hundred RuuviTags sending us a monitoring log every 5 minutes, we would have one write every 3 seconds, which I consider a pretty low frequency. To make it more interesting, I will assume that writes are more frequent than that.

Regarding the technology to use for the mysimbdp-coredms, I first need to take into account the kind of data I will store. The tortoise data is probably used to ensure that the tortoises (and maybe other animals) are in comfortable environmental conditions. Only in extreme rare cases, an animal's life might be in danger. In the rare event of a risky animal situation, both unconsistency and unavailability can lead to a disaster. Thus, I believe that I should'nt base my decision on the CAP theorem.

Cassandra provides constant-time writes, which is perfect for my case, since the writes are nearly constant. On the other hand, MongoDB is more problematic with that, partly because of the b-tree based storage engine and because of the multi-granularity locking it does. I believe that reads to my database will be unfrequent, so I don't need to worry about that. Also, Cassandra uses Cassandra Query Language (CQL), which closely resembles the traditional SQL syntax. Since I'm more familiar with the SQL syntax, I think Cassandra will be easier to implement for me.

All in all, I decided that I will use Apache Cassandra to implement mysimbdp-coredms.

**2. Design and explain interactions between main components in your architecture of mysimbdp.**

This first Assignment of the BDP course doesn't require advanced setups. Since I have never built a big database infraestructure and some of the tools will be new to me, I'll try to keep it as simple as possible.

As per the **mysimbdp-daas** component, I'll create a simple REST API written in CommonJS (Javascript for NodeJS). The REST API allows access to resources in a limited and standard way. Clients can create, request, update or delete database entries. Because this API will provide access to the whole database, I'll set an authentication mechanism. By now, I'll do this with Json Web Token (JWT). I'll use ExpressJS to create the API and Datastax's nodejs-driver for Cassandra to interact with the database.

I'll also create the **mysimbdp-dataingest** component in a NodeJS environment. This component will be run in the client side. The CSV files containing tortoise information will be stored in the same filesystem. In this way, the dataingest program will read CSVs as soon as they are created and will move them to a temporary folder. The dataingest will also run Datastax's nodejs-driver to connect to Cassandra and write the files.

**3. Explain a configuration of a cluster of nodes for mysimbdp-coredms so that you do not have a single-point-of-failure problem for mysimbdp-coredms for your tenants**

Cassandra allows the creation of a cluster of nodes in a peer-to-peer communication style. Each request is routed to one of the nodes, which acts as a coordinator. Besides, Cassandra's primary features concerning availability are partitioning and replication.

To start, I think it is a good idea to use two datacenters to store my data. Each datacenter will have a minimum of two replicated nodes.

**4. You decide a pre-defined level of data replication for your tenants/customers. Explain how many nodes are needed in the deployment of mysimbdp-coredms for your choice so that this component can work property (e.g., the system still supports redundancy in the case of a failure of a node)**

I assume that writings will be much more frequent than readings. For this reason, it's not a good idea to have a very high replication (replication improves readings but decreases write speed). The replication factor (RF) will be of 2, meaning that each row will be stored in two different nodes. I'll use the "NetworkTopologyStrategy", which places replicas in the same datacenter in different racks.

**5. Explain how would you scale mysimbdp to allow many tenants using mysimbdp-dataingest to push data into mysimbdp**

> In an ideal horizontally scalable system, addition of hardware should provide linear increases in capacity available without reconfiguration or downtime required of existing nodes. Apache Cassandra meets the requirements of an ideal horizontally scalable system by allowing for seamless addition of nodes. As you need more capacity, you add nodes to the cluster and the cluster will utilize the new resources automatically (DataStax, 2010).

# Implementation

**1. Design, implement and explain the data schema/structure for mysimbdp-coredms.**

The fields of the tortoise data are: time, readable_time, acceleration, acceleration_x, acceleration_y, acceleration_z, battery, humidity, pressure, temperature and dev-id.

Since our data is pretty simple, we will have a single table (with its corresponding partitioning and replication) storing each Ruuvitag's values. Besides those values, I'll create an atribute storing the month of the reading. I explain why in question 2. Finally, _dev-id_, _month_ and _time_ will form a compound key. The rest of the parameters will be simple atribute columns.

```
CREATE TABLE ruuvitag_measures (
    dev-id text,
    month text,
    ts timeuuid,
    acceleration int,
    acceleration_x int,
    acceleration_y int,
    acceleration_z int,
    battery int,
    humidity int,
    pressure int,
    temperature int,
    primary key((dev-id, month), ts)
) WITH CLUSTERING ORDER BY (ts DESC)
    AND COMPACTION = {'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1};
```

**2. Design a strategy for data partitioning/sharding and explain your implementation for data partitioning/sharding together with your design for replication in Part 1, Point 4, in mysimbdp-coredms.**

In Cassandra, data modeling is query-driven, which means that we design our tables for specific queries. I need to worry about this mainly because queries are best designed to access a single table. If a query needs to access several tables, the latency might be too long. The process of denormalization (duplicating data across different tables) will help me with that.

The question is: how will users read data from our database? Most of the time, users will be interested in a single Ruuvitag. So, we want to keep each ruuvitag's data as gathered as possible. I also assume that users will be interested in detecting anomalities in any of the Ruuvitag parameters. The following query will be the most typical for my database:

Q1: Find all historical data for the Ruuvitag with id _dev-id_.

Based on this query, it makes no sense to denormalize data per parameter (e.g. create a table for pressure, another one humidity and so on) to optimize reads. Instead, I will create a single table that will keep all the parameters. As I said before, the _dev-id_ identifying the Ruuvitag, the _month_ and the timestamp (_time_) will form a compound primary key. I'd like to use _dev-id_ as the partition key, but this would result in evergrowing partitions. That's why I created the _month_ field. I'll use _dev-id_ and _month_ as partition key, so all data will be partitioned depending on the device and the month. To order Ruuvitag data by time, the _time_ field will be a clustering column in ascending order.

**3. Write a mysimbdp-dataingest that takes data from your selected sources and stores the data into mysimbdp-coredms. Explain possible consistency options for writing data in your mysimdbp-dataingest.**

One of the potential issues would be that clients tried to store values not supported in the table schema. In cases like that, the server rejects the insert. Another option would be the following. Whenever a new CSV file is detected, the program checks if its headers coincide with the required fields in the database. If they don't the client would be allowed to create his own new table under certain restrictions.

**4. Given your deployment environment, show the performance (response time and failure) of the tests for 1,5, 10, .., n of concurrent mysimbdp-dataingest writing data into mysimbdp-coredms with different speeds/velocities. Indicate any performance differences due to the choice of consistency options.**

The cassandra-driver library for NodeJS limits the concurrent transactions by client to 2048. I made the following tests inserting a single file with 15,969 rows. On one hand, I tested with 1, 5, 10 and 25 concurrent mysimbdp-dataingest processes. I combined the previous with different transaction concurrency limits: 10, 100, 1000 and 2048. Thus, the maximum will be 25*2048 = 51200 concurrent inserts.

### 1 process

| concurrency limit | time/process   | rows/s |
|-------------------|--------|--------|
| 10                | 37.496 | 426    |
| 100               | 10.282 | 1553   |
| 1000              | 7.006  | 2279   |
| 2048              | 6.835  | 2336   |

### 5 processes

| concurrency limit | time/process   | rows/s |
|-------------------|--------|----------|
| 10                | 34.794 |      459    |
| 100               | 11.983 |     1333     |
| 1000              | 9.180  |   1740       |
| 2048              |  10.380 |    1538      |

### 10 processes

| concurrency limit | time/process   | rows/s |
|-------------------|--------|----------|
| 10                | 36.624 |    436      |
| 100               | 15.089 |   1058       |
| 1000              | 13.669  |  1169        |
| 2048              | 15.836  |  1008        |

### 25 processes

| concurrency limit | time/process   | rows/s |
|-------------------|--------|----------|
| 10                | 41.563 |    384      |
| 100               | 30.424 |     525     |
| 1000              |  31.355 |    509      |
| 2048              |  34.520 |    427      |

Looking at the performance results, it seems that the bootleneck is at the client side. For example, looking at the time per process with 10 concurrent transactions, they are very similar. This suggests that what takes time is the processing of the csv file. Adding more processes doesn't seem to add more load to the clusters.

**5. Observing the performance and failure problems when you push a lot of data into mysimbdp-coredms (you do not need to worry about duplicated data in mysimbdp), propose the change of your deployment to avoid such problems (or explain why you do not have any problem with your deployment).**

As I said, what seems to cause more trouble is the reading of the CSV files. At this moment, all the CSV is written to memory first when it is parsed with csv-parse library. Moreover, the whole memory object is mapped into arrays of arrays as a matter of code design. This could be improved by writting some middle component which directly produced the CSV rows correctly formatted.

# Extension

**1. Using your mysimdbp-coredms, a single tenant can create many different databases/datasets. Assume that you want to support the tenant to manage metadata about the databases/datasets, what would be your solution?**

I would first create a table representing databases in mysimbdp-coredms. That table would have a record per database and would have the following fields: number of tables, total number of rows, used capacity of tenant's contract, number of nodes holding the database, datacenters in which the database is located, topology strategy, etc.

Also, I would create a table to represent other tables more specifically. Each table would have its own row and would keep track of number of rows, number of partitions used, replication state, etc.

<!-- **2. Assume that each of your tenants/users will need a dedicated mysimbdp-coredms. Design the data schema of service information for mysimbdp-coredms that can be published into an existing registry (like ZooKeeper, consul or etcd) so that you can find information about which mysimbdp-coredms is for which tenants/users.**
 -->

<!-- 
**3. Explain how you would change the implementation of mysimbdp-dataingest (in Part 2) to integrate a service discovery feature (no implementation is required).** -->

**4. Assume that now only mysimbdp-daas can read and write data into mysimbdp-coredms, how would you change your mysimbdp-dataingest (in Part 2) to work with mysimbdp-daas?**

My idea was to create a simple REST API to manage resources in the database. I would change dataingest to query that API instead. API queries would be made mostly to a single endpoint to insert new rows in the database.

**5. Assume that you design APIs for mysimbdp-daas so that any other developer who wants to implement mysimbdp-dataingest can write his/her own ingestion program to write the data into mysimbdp-coredms by calling mysimbdp-daas. Explain how would you control the data volume and speed in writing and reading operations for a tenant?**

I would use the NodeJS library "express-rate-limit", which allows to limit the number of requests per timeframe and IP.

If I wanted to set user specific limits, I would have to implement some kind of logging mechanism so that all requests are on behalf of a certain user and his rate limit is adjusted.