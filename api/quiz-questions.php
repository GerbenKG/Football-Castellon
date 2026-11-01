<?php
declare(strict_types=1);
// Server-only question bank. Never return the answer index before both players finish.
function arcadeQuestions(): array
{
    return [
        ['Which country won the 2010 men’s World Cup?', ['Spain','Netherlands','Germany','Brazil'],0],
        ['Which club plays its home matches at Anfield?', ['Everton','Liverpool','Arsenal','Chelsea'],1],
        ['Which country won the 1998 men’s World Cup?', ['Brazil','Italy','France','Argentina'],2],
        ['What is a hat-trick?', ['Three goals by one player in a match','Three corners in a row','Three saved penalties','Three substitutions'],0],
        ['Which country is Ajax from?', ['Belgium','Germany','Netherlands','Denmark'],2],
        ['How many players does a standard football team start with?', ['9','10','11','12'],2],
        ['Which country won the 2022 men’s World Cup?', ['France','Argentina','Croatia','Morocco'],1],
        ['Which club is nicknamed the Gunners?', ['Tottenham','Chelsea','West Ham','Arsenal'],3],
        ['Which country hosted the 2014 men’s World Cup?', ['Brazil','South Africa','Russia','Germany'],0],
        ['Which city is home to Celtic and Rangers?', ['Edinburgh','Glasgow','Aberdeen','Dundee'],1],
        ['Which club plays at San Mamés?', ['Real Sociedad','Valencia','Athletic Club','Sevilla'],2],
        ['Which country did Johan Cruyff represent?', ['Belgium','Netherlands','Germany','Austria'],1],
        ['What does a clean sheet mean?', ['No yellow cards','No substitutions','No goals conceded','No fouls'],2],
        ['Which country won UEFA Euro 2004?', ['Portugal','Greece','Spain','France'],1],
        ['Which city is home to Borussia Dortmund?', ['Dortmund','Munich','Bremen','Leipzig'],0],
        ['Which country did Diego Maradona represent?', ['Uruguay','Brazil','Chile','Argentina'],3],
        ['Which club is nicknamed the Toffees?', ['Leeds United','Everton','Fulham','Newcastle United'],1],
        ['Which country won the 2006 men’s World Cup?', ['France','Germany','Italy','Spain'],2],
        ['What is the usual length of one half, before added time?', ['30 minutes','40 minutes','45 minutes','50 minutes'],2],
        ['Which club is based in Turin?', ['Napoli','Juventus','Roma','Lazio'],1],
        ['Which country did Zinedine Zidane represent?', ['France','Spain','Algeria','Italy'],0],
        ['Which club plays its home matches at Old Trafford?', ['Manchester City','Liverpool','Manchester United','Leicester City'],2],
        ['Which country won the 2014 men’s World Cup?', ['Argentina','Brazil','Netherlands','Germany'],3],
        ['Which city is home to Benfica and Sporting CP?', ['Porto','Lisbon','Braga','Coimbra'],1],
        ['Which country hosted the 2010 men’s World Cup?', ['Egypt','Morocco','South Africa','Nigeria'],2],
        ['Which country did Paolo Maldini represent?', ['Italy','Spain','Portugal','France'],0],
        ['Which club is nicknamed the Magpies?', ['Crystal Palace','Brighton','Newcastle United','Southampton'],2],
        ['Which country won UEFA Euro 2016?', ['France','Portugal','Germany','Wales'],1],
        ['Which city is home to Atlético and Real?', ['Barcelona','Seville','Valencia','Madrid'],3],
        ['Which country won the first men’s World Cup in 1930?', ['Brazil','Argentina','Uruguay','Italy'],2],
    ];
}
