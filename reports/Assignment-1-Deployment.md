# This is a deployment/installation guide

This file contains a description to install and run the programs needed for Assignment 1.

# Requirements

The following packages are required to use the code in this Assignment:
- npm v7.0.3
- node v15.0.1

Also, this project was developed in an Ubuntu 18.04.4 LTS machine. However, it could be easily reproduced in other operative systems.

# Installation

## mysimbdp-dataingest

To install and run mysimbdp-dataingest, go to [code/dataingest](../code/dataingest). Follow the next instructions in order to install and run the program.

1) First, install the dependencies by running `npm install`.
2) Copy the file .env.template to .env and fill the values. See [Configuration options](#configuration)
3) Run the program: `npm start`
4) Manually move CSV files into CSV_ROOTDIR. The program will detect them and try to insert them into the database.

### Configuration

The following fields need to be filled up in an .env file in order for the program to work.

- CSV_SEPARATOR: indicates the kind of separator in the input CSV files. For the tortoise sample data you can use a comma (",").
- CSV_ROOTDIR: the relative root directory in which the CSV files will be dropped.
- CSV_COLUMNS: 1 or 0 depending on the presence of a first header row in each CSV file.
- CSV_WATCH_INTERVAL: the interval at which the watcher should look for new files in the CSV_ROOTDIR.
- COREDMS_NODE1: IP address of a node in the mysimbdp-coredms cluster. 
- COREDMS_NODE2: IP address of a node in the mysimbdp-coredms cluster. Must be different than COREDMS_NODE1.
- COREDMS_LOCAL_DATACENTER: the name of the datacenter for which queries will try first (E.g., europe-north1).
- INGESTION_CONCURRENCY_LEVEL: number of concurrent insert transactions the program will perform. Limited to 2048.
