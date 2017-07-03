<?php

Header('Access-Control-Allow-Origin: *');
Header('Content-Type: application/json');

$clusterName = $_GET['clusterName'];
$ips = $_GET['ips'];

if (empty($clusterName) || empty($ips)) {
  Header('Status: 400 Bad Request');
  print json_encode(['ok' => false, 'msg' => 'Missing clusterName/ips.']);
  exit;
}

$nodeNo = 1;
$ipArr = explode(',', $ips);

foreach ($ipArr as $ip) {
  $try = 1;

  // Loop until connection achieved.
  do {
    error_log('Connecting to ' . $ip . ' (Try: ' . $try++ . ').');
    $conn = @ssh2_connect($ip, 22);
    $auth = @ssh2_auth_password($conn, 'root', 'acs_cluadmin');

    $madeConn = ($conn && $auth);

    if ($madeConn) {
      $command = "/root/db_cluster.sh {$clusterName} {$nodeNo} {$ipArr[0]} {$ips} > db_cluster.sh.log";

      error_log("[root@$ip] $command");
      $stream = ssh2_exec($conn, $command);
      $nodeNo++;
    }

    // If there is no connection, let's give it a break. The VM is supposed to be turning on!
    if (!$madeConn) {
      sleep(5);
    }
  } while (!$madeConn/* && $try < 10*/);
}

Header('Status: 200 OK');
print json_encode(['ok' => true]);

?>
