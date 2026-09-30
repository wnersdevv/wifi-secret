param(
  [Parameter(Mandatory=$true)][ValidateSet('status','start','stop','configure','clients')]
  [string]$Action,
  [string]$Ssid,
  [string]$Passphrase,
  [string]$Band
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $resultType) {
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($op))
  $task.Wait(30000) | Out-Null
  $task.Result
}

function Get-TetheringManager {
  [void][Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime]
  [void][Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime]
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if ($null -eq $profile) { throw 'No internet connection profile available to share.' }
  return [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
}

function StateName($s) {
  switch ([int]$s) {
    0 { 'Unknown' }
    1 { 'On' }
    2 { 'Off' }
    3 { 'InTransition' }
    default { "State$s" }
  }
}

$out = [ordered]@{ ok = $true; action = $Action }

try {
  $mgr = Get-TetheringManager

  switch ($Action) {
    'status' {
      $cfg = $mgr.GetCurrentAccessPointConfiguration()
      $out.state = StateName($mgr.TetheringOperationalState)
      $out.clientCount = $mgr.ClientCount
      $out.maxClientCount = $mgr.MaxClientCount
      $out.ssid = $cfg.Ssid
      $out.band = $cfg.Band.ToString()
    }
    'configure' {
      $cfg = $mgr.GetCurrentAccessPointConfiguration()
      if ($Ssid) { $cfg.Ssid = $Ssid }
      if ($Passphrase) { $cfg.Passphrase = $Passphrase }
      $res = Await ($mgr.ConfigureAccessPointAsync($cfg)) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
      $out.status = $res.Status.ToString()
      $out.ok = ($res.Status -eq 0)
    }
    'start' {
      if ($mgr.TetheringOperationalState -eq 1) {
        $out.state = 'On'; $out.alreadyRunning = $true
      } else {
        $res = Await ($mgr.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
        $out.status = $res.Status.ToString()
        $out.ok = ($res.Status -eq 0)
        $out.state = StateName($mgr.TetheringOperationalState)
      }
    }
    'stop' {
      if ($mgr.TetheringOperationalState -eq 2) {
        $out.state = 'Off'; $out.alreadyStopped = $true
      } else {
        $res = Await ($mgr.StopTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
        $out.status = $res.Status.ToString()
        $out.ok = ($res.Status -eq 0)
        $out.state = StateName($mgr.TetheringOperationalState)
      }
    }
    'clients' {
      $out.clientCount = $mgr.ClientCount
      $neighbors = Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.State -in 'Reachable','Stale','Permanent' -and $_.LinkLayerAddress -and $_.IPAddress -match '^(192\.168\.137\.|172\.)' } |
        Select-Object @{n='ip';e={$_.IPAddress}}, @{n='mac';e={$_.LinkLayerAddress}}, @{n='state';e={$_.State.ToString()}}
      $out.clients = @($neighbors)
    }
  }
} catch {
  $out.ok = $false
  $out.error = $_.Exception.Message
}

$out | ConvertTo-Json -Depth 6 -Compress
