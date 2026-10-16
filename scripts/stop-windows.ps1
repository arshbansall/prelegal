# Stop Prelegal on Windows. The database is discarded with the container.
$Name = "prelegal"

# `docker rm -f` succeeds even when there is no such container, so check first.
if (docker ps -aq --filter "name=^$Name$") {
    docker rm -f $Name | Out-Null
    Write-Host "Prelegal stopped."
} else {
    Write-Host "Prelegal is not running."
}
