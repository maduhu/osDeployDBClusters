#!/bin/bash

# ./db_cluster.sh omar_clu 1 10.0.1.163 10.0.1.163
# ./db_cluster.sh [cluster-name] [node-no] [first-ip] [all-comma-separated-ips]

ipaddr=$(hostname -I | xargs)

cat <<EOF > /etc/my.cnf.d/server.cnf
# /etc/my.cnf.d/server.cnf

[galera]
# Mandatory settings
wsrep_on=ON
wsrep_provider=/usr/lib64/galera/libgalera_smm.so
wsrep_cluster_address='gcomm://$4'
wsrep_cluster_name='$1'
wsrep_node_address='$ipaddr'
wsrep_node_name='galera$2'
wsrep_sst_method=rsync
binlog_format=row
default_storage_engine=InnoDB
innodb_autoinc_lock_mode=2
bind-address=0.0.0.0
EOF

setenforce 0
systemctl stop mysql

if [ "$ipaddr" == "$3" ]
then
   galera_new_cluster
else
   systemctl start mariadb
fi
