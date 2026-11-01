<?php
declare(strict_types=1);
require __DIR__ . '/../api/bootstrap.php';
set_exception_handler(static function (Throwable $error): void { fwrite(STDERR, $error->getMessage()); exit(1); });
foreach (['castellon.futbol' => 'db-config.php', 'dev.castellon.futbol' => 'db-config.dev.php'] as $host => $expected) {
    if (basename(databaseConfigPath($host)) !== $expected) throw new RuntimeException('Wrong database configuration for ' . $host);
    echo "PASS: $host uses $expected\n";
}
if (databaseConfigPath('dev.castellon.futbol') === databaseConfigPath('castellon.futbol')) throw new RuntimeException('Development must not share the production config file');
echo "PASS: production and development configuration files are isolated\n";
