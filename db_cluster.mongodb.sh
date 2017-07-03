#!/bin/bash

# ./db_cluster.sh omar_clu 1 10.0.1.163 10.0.1.163
# ./db_cluster.sh [cluster-name] [node-no] [first-ip] [all-comma-separated-ips]

ipaddr=$(hostname -I | xargs)
ips=$4
nodeId=1
totalNodes="$(echo $ips | tr ',' '\n' | wc -l)"

hostname "$1$2"
echo "$1$2" > /etc/hostname

echo $ips | tr ',' '\n' | while read ip; do
  if ! grep -q "$ip" /etc/hosts; then
    echo "$ip $1$nodeId" >> /etc/hosts
  fi

  nodeId=$((nodeId+1))
done

cp /etc/mongod.conf /etc/mongod.conf.old

cat > /etc/mongod.conf.patch << EOF
--- /etc/mongod.conf
+++ /etc/mongod.conf
@@ -16,8 +16,9 @@
 pidfilepath=/var/run/mongodb/mongod.pid

 # Listen to local interface only. Comment out to listen on all interfaces.
-bind_ip=127.0.0.1
-
+#bind_ip=127.0.0.1
+port=27017
+replSet=rs1
 # Disables write-ahead journaling
 # nojournal=true
EOF

patch --ignore-whitespace /etc/mongod.conf /etc/mongod.conf.patch

setenforce 0
systemctl stop firewalld
systemctl disable firewalld

rm -rf /var/lib/mongo/*
mongod --config /etc/mongod.conf --smallfiles

if [ "$totalNodes" == "$2" ]
then
  mongo --eval "rs.initiate()"

  nodeId=1
  echo $ips | tr ',' '\n' | while read ip; do
     mongo --eval "rs.add(\"$1$nodeId:27017\")"
     nodeId=$((nodeId+1))
  done
fi
