(function (cloudStack) {
  cloudStack.plugins.osDeployDBClusters = function(plugin) {
    plugin.ui.addSection({
      id: 'osDeployDBClusters',
      title: 'Database Clusters',
      showOnNavigation: true,
      preFilter: function(args) {
        return isAdmin();
      },
      listView: {
        id: 'DBClusterInstances',
        actions: {
          // Add instance wizard
          add: {
              label: 'Create Cluster',
              addRow: false,
              action: {
                custom: function(args) {
                  return cloudStack.plugins.osDeployDBClusters.createDBCluster(args);
                },
              },
              messages: {
                  notification: function(args) { return 'Create Cluster'; },
              },
              /*notification: {
                  poll: pollAsyncJobResult
              }*/
          },
        },
        fields: {
          name: { label: 'label.name' },
          instancename: { label: 'label.internal.name' },
          displayname: { label: 'label.display.name' },
          zonename: { label: 'label.zone.name' }
        },
        dataProvider: function(args) {
          plugin.ui.apiCall('listVirtualMachines', {
            success: function(json) {
              var vms = json.listvirtualmachinesresponse.virtualmachine;
              var vms_out = [];

              $.each(vms, function (vmid) {
                // Validate IF db-cluster TAG.
                //if (vms[vmid].tags.length > 0) {
                  vms_out.push(this);
                //}
              });

              args.response.success({ data: vms_out });
            },
            error: function(errorMessage) {
              args.response.error(errorMessage)
            }
          });
        },
      },
    });
  };

  cloudStack.plugins.osDeployDBClusters.createDBCluster = function(args) {
    var zones = null;

    var templates = null;
    var serviceOfferings = null;
    var networks = null;
    var affinityGroups = null;

    var plugin_templates = [];

    var zone = null;
    var template = null;
    var serviceOffering = null;
    var network = null;
    var affinityGroup = null;

    $.ajax({
        url: createURL("listZones&available=true"),
        dataType: "json",
        async: false,
        success: function(json) {
            zones = json.listzonesresponse.zone;
        }
    });

    if (zones != null) {
      zone = zones[0];
    } else {
      return $('<div>').html('Error: Zone[0] not found!');
    }

    $.ajax({
        url: createURL("listTemplates&templatefilter=featured&zoneid=" + zone.id),
        dataType: "json",
        async: false,
        success: function(json) {
            templates = json.listtemplatesresponse.template;
        }
    });

    if (templates != null) {
      $.each(templates, function (tid) {
        var t = templates[tid];
        if (this.tags.length > 0) {
          $.each(t.tags, function (tagid) {
            if (this.key == 'db-cluster' && this.value == 1) {
              plugin_templates.push(t);
            }
          });
        }
      });
    } else {
      return $('<div>').html('Error: plugin_templates not found!');
    }

    if (plugin_templates.length == 0) {
      return $('<div>').html('Error: plugin_templates not found!');
    }

    $.ajax({
        url: createURL("listServiceOfferings&issystem=false"),
        dataType: "json",
        async: false,
        success: function(json) {
            serviceOfferings = json.listserviceofferingsresponse.serviceoffering;
        }
    });

    $.ajax({
        url: createURL("listNetworks&trafficType=Guest&zoneId=" + zone.id),
        dataType: "json",
        async: false,
        success: function(json) {
            networks = json.listnetworksresponse.network;
        }
    });

    /*$.ajax({
        url: createURL("listAffinityGroups"),
        dataType: "json",
        async: false,
        success: function(json) {
            affinityGroups = json.listaffinitygroupsresponse.affinitygroup;
        }
    });

    if (affinityGroups != null) {
      if (affinityGroups.length != 0) {
        $.each(affinityGroups, function (ag) {
          if (affinityGroups[ag].name == 'db-clusters') {
            affinityGroup = affinityGroups[ag];
          }
        });
      }
    }

    if (affinityGroup == null) {
      return $('<div>').html('Error: affinityGroup not found!');
    }*/

    if (networks.length == 0) {
      return $('<div>').html('Error: network not found!');
    } else {
      network = networks[0];
    }

    console.log('Plugin Templates');
    console.log(plugin_templates);

    var formSchema = {
        title: 'Create Database Cluster',
        desc: '',
        createLabel: 'Create Cluster',
        fields: {
            name: {
                label: 'Cluster Name',
                validation: {
                    required: true
                }
            },
            rootDiskSize: {
                label: 'ROOT Disk Size (in GB)',
            },
            clusterSize: {
                label: 'Cluster Size',
                select: function(args) {
                  var sizes = [];

                  for (i = 3; i < 16; i++) {
                    sizes.push({id: i, name: i});
                  }

                  args.response.success({
                    descriptionField: 'name',
                    data: sizes,
                  });
                },
            },
            /*zone: {
                label: 'Zone',
                select: function(args) {
                  args.response.success({
                    descriptionField: 'name',
                    data: [zone],
                  });
                },
            },*/
            template: {
                label: 'Template',
                select: function(args) {
                  args.response.success({
                    descriptionField: 'name',
                    data: plugin_templates,
                  });
                },
            },
            serviceOffering: {
                label: 'Service Offering',
                select: function(args) {
                  $.each(serviceOfferings, function() {
                    this.custom_name = this.displaytext + ' (CPU Cores: ' + this.cpunumber + '; CPU Speed: ' + this.cpuspeed + ' MHz; Memory: ' + this.memory + ' MBs)';
                  });

                  args.response.success({
                    descriptionField: 'custom_name',
                    data: serviceOfferings,
                  });
                },
            },
            /*network: {
                label: 'Network',
                select: function(args) {
                  args.response.success({
                    descriptionField: 'name',
                    data: [network],
                  });
                },
            },
            affinityGroup: {
                label: 'Affinity Group',
                select: function(args) {
                  args.response.success({
                    descriptionField: 'name',
                    data: [affinityGroup],
                  });
                },
            },*/
        }
    };

    cloudStack.dialog.createForm({
      form: formSchema,
      after: function(args) {
        // This was a great idea IF Network is not basic. Set IP to cluster.
        /*var vLANs = null;
        var virtualMachines = null;
        var availableIPs = [];

        $.ajax({
            url: createURL("listVlanIpRanges&zoneid=" + zone.id),
            dataType: "json",
            async: false,
            success: function(json) {
              vLANs = json.listvlaniprangesresponse.vlaniprange;

              if (vLANs.length > 0) {
                var ipToHex = function (ip) {
                  var split = ip.split(".");
                  return parseInt(split[3]) * Math.pow(256, 0) + parseInt(split[2]) * Math.pow(256, 1) + parseInt(split[1]) * Math.pow(256, 2) + parseInt(split[0]) * Math.pow(256, 3);
                };

                var startIPHex = ipToHex(vLANs[0].startip);
                var endIPHex = ipToHex(vLANs[0].endip);

                for (var i = startIPHex; i < endIPHex; i++) {
                  var oc4 = (i>>24) & 0xff;
                  var oc3 = (i>>16) & 0xff;
                  var oc2 = (i>>8) & 0xff;
                  var oc1 = i & 0xff;

                  availableIPs.push(oc4 + "." + oc3 + "." + oc2 + "." + oc1);
                }
              }
            }
        });

        $.ajax({
            url: createURL("listVirtualMachines&zoneid=" + zone.id),
            dataType: "json",
            async: false,
            success: function(json) {
                virtualMachines = json.listvirtualmachinesresponse.virtualmachine;

                $.each(virtualMachines, function() {
                  var vmIP = this.nic[0].ipaddress;
                  var index = availableIPs.indexOf(vmIP);

                  if (index > -1) {
                    //console.log('Removing IP: ' + vmIP);
                    availableIPs.splice(index, 1);
                  }
                });
            }
        });

        shuffle(availableIPs);*/

        $('#container').prepend($('<div>').addClass('loading-overlay'));

        var deployVmData = {};
        var totalJobsCompleted = 0;
        var vmInfo = {};
        var vmIPs = {};
        var arr = [];
        for (let i = 1; i <= args.data.clusterSize; i++) arr.push(i);

        $.each(arr, function (n) {
          var nodeId = this;
          var displayName = args.data.name + nodeId;

          deployVmData[nodeId] = {
            name: displayName,
            displayName: displayName,
            zoneid: zone.id,
            templateid: args.data.template,
            serviceofferingid: args.data.serviceOffering,
            //affinitygroupids: affinityGroup.id,
            //ipaddress: availableIPs[0],
          };

          console.log('Deploying ' + nodeId);
          console.log(deployVmData[nodeId]);

          $.ajax({
            url: createURL('deployVirtualMachine'),
            data: deployVmData[nodeId],
            success: function(json) {
                var jobId = json.deployvirtualmachineresponse.jobid;
                var vmid = json.deployvirtualmachineresponse.id;
                vmInfo[displayName] = {nodeId: nodeId, vmId: vmid};
                var checkVMStatusIntervalID = setInterval(function() {
                  $.ajax({
                      url: createURL('queryAsyncJobResult'),
                      data: {
                          jobid: jobId
                      },
                      success: function(json) {
                        var result = json.queryasyncjobresultresponse;

                        if (result.jobstatus == 0) {
                          return;
                        } else {
                          clearInterval(checkVMStatusIntervalID);

                          console.log(json);

                          if (result.jobstatus == 1) {
                            console.log(jobId + ' Ok!');
                          } else if (result.jobstatus == 2) {
                            console.log(result.jobresult.errortext);
                          }

                          if (++totalJobsCompleted == args.data.clusterSize) {
                            $('.loading-overlay').remove();
                            cloudStack.dialog.notice({
                                message: 'All VMs jobs completed! Now identify IPs and RUN db_cluster.sh.'
                            });

                            $.ajax({
                              url: createURL('listVirtualMachines'),
                              success: function(json) {
                                var vms = json.listvirtualmachinesresponse.virtualmachine;
                                var vms_out = [];

                                $.each(vms, function () {
                                  if (vmInfo[this.name] && vmInfo[this.name].vmId == this.id) {
                                    vmIPs[vmInfo[this.name].nodeId] = this.nic[0].ipaddress;

                                    var keys = Object.keys(vmIPs);
                                    var values = keys.map(function(v) { return vmIPs[v]; });

                                    if (values.length == args.data.clusterSize) {
                                      var url = "http://" + window.location.hostname + "/db_cluster.php?clusterName=" + args.data.name + "&ips=" + values.join();

                                      console.log(values);
                                      console.log("URL = " + url);

                                      var clusterIPs = values.join("; ");

                                      $.ajax({
                                        url: url,
                                        success: function(json) {
                                          cloudStack.dialog.notice({
                                            message: 'Cluster is Ready! IPs: ' + clusterIPs + '.<br><br>Password for VMs is: <b>acs_cluadmin</b>.<br>Remember to change it!'
                                          });
                                        },
                                        error: function(XMLHttpResponse) {
                                          cloudStack.dialog.notice({
                                            message: parseXMLHttpResponse(XMLHttpResponse)
                                          });
                                        }
                                      });
                                    }
                                  }
                                });
                              },
                            });
                          }

                          console.log("totalJobsCompleted = " + totalJobsCompleted + "; " + args.data.clusterSize);
                        }
                      }
                  });
                }, g_queryAsyncJobResultInterval)
            },
            error: function(XMLHttpResponse) {
                cloudStack.dialog.notice({
                  message: parseXMLHttpResponse(XMLHttpResponse)
                });
            }
          });
        });
      }
    });

    function shuffle(a) {
        var j, x, i;
        for (i = a.length; i; i--) {
            j = Math.floor(Math.random() * i);
            x = a[i - 1];
            a[i - 1] = a[j];
            a[j] = x;
        }
    };
  };
}(cloudStack));
