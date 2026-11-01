<?php
declare(strict_types=1);
require __DIR__.'/../api/auth/error-page.php';
foreach(['unknown','disabled','error'] as $reason){
 $html=authErrorPage('Session expired. <script>alert(1)</script>',$reason,'name+<img src=x onerror=alert(1)>@example.test');
 foreach(['name="viewport"','/club.css','/club-crest.svg','Back to sign-in','no-referrer'] as $part)if(!str_contains($html,$part))throw new RuntimeException('Missing branded/recovery content');
 if(str_contains($html,'<script>')||str_contains($html,'<img src=x'))throw new RuntimeException('Unescaped text');
 if($reason==='unknown'&&!str_contains($html,'not registered as a club member'))throw new RuntimeException('Unknown membership unclear');
 if($reason==='disabled'&&!str_contains($html,'currently disabled'))throw new RuntimeException('Disabled membership unclear');
 if($reason!=='error'&&!str_contains($html,'Ask the board for access'))throw new RuntimeException('Missing board access instructions');
 echo "PASS branded $reason sign-in page, recovery links and escaped account details\n";
}
