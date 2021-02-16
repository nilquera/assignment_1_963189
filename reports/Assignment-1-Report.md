# This your assignment report

It is a free form. you can add:

- your designs
- your answers to questions in the assignment
- your test results
- etc.

The best way is to have your report written in the form of point-to-point answering the assignment.

# Assignment 1 report

In this file we look into the details of my solution for the first assignment. I will also answer the questions provided by the course.

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

I'll also create the **mysimbdp-dataingest** component in a NodeJS environment. This component will be run in the client side. The CSV files containing tortoise information will be stored in the same hardware. In this way, the dataingest program will read CSVs as soon as they are created and will move them to a temporary folder. The dataingest will also run Datastax's nodejs-driver to connect to Cassandra and write the files.

**3. Explain a configuration of a cluster of nodes for mysimbdp-coredms so that you do not have a single-point-of-failure problem for mysimbdp-coredms for your tenants**

Cassandra allows the creation of a cluster of nodes in a peer-to-peer communication style. Each request is routed to one of the nodes, which acts as a coordinator. Besides, Cassandra's primary features concerning availability are partitioning and replication.

To start, I think it is a good idea to use two datacenters to store my data. Each datacenter will have a minimum of two replicated nodes. I'll use the NetworkTopologyStrategy, which places replicas in the same datacenter always in different racks. Thus, I'll create four nodes distributed in two datacenters.

**4. You decide a pre-defined level of data replication for your tenants/customers. Explain how many nodes are needed in the deployment of mysimbdp-coredms for your choice so that this component can work property (e.g., the system still supports redundancy in the case of a failure of a node)**

I assume that in my scenario, writings will be much more frequent than readings. For this reason, it's not a good idea to have a very high replication. The replication factor (RF) will be of 2, meaning that each row will be stored in two different nodes (in the same datacenter). In total, I'll have four nodes, two in each datacenter. The partition level will be of 2, meaning that rows will be written only in one of the two datacenters.

**5. Explain how would you scale mysimbdp to allow many tenants using mysimbdp-dataingest to push data into mysimbdp**

> In an ideal horizontally scalable system, addition of hardware should provide linear increases in capacity available without reconfiguration or downtime required of existing nodes. Apache Cassandra meets the requirements of an ideal horizontally scalable system by allowing for seamless addition of nodes. As you need more capacity, you add nodes to the cluster and the cluster will utilize the new resources automatically (DataStax, 2010).

# Implementation

**1. Design, implement and explain the data schema/structure for mysimbdp-coredms.**

**2. Design a strategy for data partitioning/sharding and explain your implementation for data partitioning/sharding together with your design for replication in Part 1, Point 4, in mysimbdp-coredms.**

**3. Write a mysimbdp-dataingest that takes data from your selected sources and stores the data into mysimbdp-coredms. Explain possible consistency options for writing data in your mysimdbp-dataingest.**

**4. Given your deployment environment, show the performance (response time and failure) of the tests for 1,5, 10, .., n of concurrent mysimbdp-dataingest writing data into mysimbdp-coredms with different speeds/velocities. Indicate any performance differences due to the choice of consistency options.**

**5. Observing the performance and failure problems when you push a lot of data into mysimbdp-coredms (you do not need to worry about duplicated data in mysimbdp), propose the change of your deployment to avoid such problems (or explain why you do not have any problem with your deployment).**

# Extension

**1. Using your mysimdbp-coredms, a single tenant can create many different databases/datasets. Assume that you want to support the tenant to manage metadata about the databases/datasets, what would be your solution?**

**2. Assume that each of your tenants/users will need a dedicated mysimbdp-coredms. Design the data schema of service information for mysimbdp-coredms that can be published into an existing registry (like ZooKeeper, consul or etcd) so that you can find information about which mysimbdp-coredms is for which tenants/users.**

**3. Explain how you would change the implementation of mysimbdp-dataingest (in Part 2) to integrate a service discovery feature (no implementation is required).**

**4. Assume that now only mysimbdp-daas can read and write data into mysimbdp-coredms, how would you change your mysimbdp-dataingest (in Part 2) to work with mysimbdp-daas?**

**5. Assume that you design APIs for mysimbdp-daas so that any other developer who wants to implement mysimbdp-dataingest can write his/her own ingestion program to write the data into mysimbdp-coredms by calling mysimbdp-daas. Explain how would you control the data volume and speed in writing and reading operations for a tenant?**
