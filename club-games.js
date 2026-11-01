(() => {
  'use strict';
  let club=null,C=null,state=null,error='',loadPromise=null,identity='',loaded=0,draft=false,saving=false;
  const predictionDrafts=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const person=id=>state?.people.find(p=>p.id===id)||{id,name:'Club member'};
  const label=id=>{const p=person(id);return window.ClubFavorites.label(p.name,p.player_id,p);};
  const avatar=id=>{const p=person(id);return window.ClubAvatar.render({...p,display_name:p.name});};
  const joined=game=>state?.joined.includes(game);
  const sub=()=>location.hash.split('/')[1]||'';
  const button=(text,action,id='',style='primary')=>`<button type="button" class="btn btn-${style}" data-arcade="${action}" data-id="${esc(id)}">${text}</button>`;
  const stamp=t=>new Date(t).toLocaleString('en-GB',{timeZone:'Europe/Madrid',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const number=(name,value,label)=>`<input type="number" name="${name}" min="0" max="30" step="1" inputmode="numeric" value="${esc(value??'')}" aria-label="${esc(label)}" required>`;
  const note=text=>`<div class="notice">${text}</div>`;
  function cards(){
    return `<div class="games-cards"><article class="game-card predictions-card"><div class="game-card-symbol">${C.icon('trophy',32)}</div><div class="eyebrow">Read the game</div><h2>Prediction League</h2><p>Real fixtures. Your football instincts. A whole club to prove wrong.</p><div class="game-card-facts"><span>3 points · exact score</span><span>1 point · correct result</span></div><div class="game-card-bottom"><small>${state.prediction_members} members joined</small>${joined('predictions')?'<a class="btn btn-primary" href="#games/predictions">Make your predictions →</a>':button('Join Prediction League','join','predictions')}</div></article><article class="game-card quiz-card"><div class="game-card-symbol">${C.icon('squad',32)}</div><div class="eyebrow">Settle it on the questions</div><h2>Challenge a teammate</h2><p>Think you know more football? Pick a rival and let five questions decide.</p><div class="game-card-facts"><span>The same 5 questions</span><span>Play in your own time</span></div><div class="game-card-bottom"><small>${state.quiz_members.length} members joined</small>${joined('quiz')?'<a class="btn btn-primary" href="#games/quiz">Find your next rival →</a>':button('Join teammate challenges','join','quiz')}</div></article></div>`;
  }
  function overview(){
    const waiting=state.challenges.filter(c=>c.status==='active'&&!c.my_submitted).length;
    return `<section class="games-hero"><div><div class="eyebrow">The final whistle is just the beginning</div><h2>Same club.<br>A little more rivalry.</h2><p>Pick your scores. Challenge a mate. Bring the bragging rights to the next match.</p></div><div class="games-hero-emblem" aria-hidden="true">${C.icon('trophy',90)}<span>PLAY FOR<br>THE GLORY</span></div></section>${waiting?`<a class="games-invitation" href="#games/quiz"><span>${C.icon('news',19)} You have ${waiting} quiz challenge${waiting===1?'':'s'} to play.</span><strong>Let’s go →</strong></a>`:''}${cards()}<div class="games-how"><div><strong>For the club. For fun.</strong><p>No entry fees or cash prizes. Just football knowledge and friendly competition.</p></div><div><strong>Your place, your choice.</strong><p>Join either game, or both. You can leave whenever you like; your results stay recorded.</p></div></div>`;
  }
  function league(){
    let previous='',rank=0;
    const table=state.leaderboard.map((row,i)=>{const key=`${row.points}:${row.exact}`;if(key!==previous){rank=i+1;previous=key;}return `<tr ${row.user_id===club.user.id?'class="games-you"':''}><td>${rank}</td><th scope="row"><span class="games-person">${avatar(row.user_id)}<span>${label(row.user_id)}${row.user_id===club.user.id?'<small>You</small>':''}</span></span></th><td>${row.played}</td><td>${row.exact}</td><td><strong>${row.points}</strong></td></tr>`;}).join('');
    return `<section class="panel panel-pad games-leaderboard"><div class="section-title"><div><h2>The club leaderboard</h2><p>All rounds · tied points are separated by exact scores</p></div>${C.icon('trophy',22)}</div>${table?`<div class="games-table-wrap"><table class="games-table"><thead><tr><th>Rank</th><th>Member</th><th>Played</th><th>Exact</th><th>Pts</th></tr></thead><tbody>${table}</tbody></table></div>`:'<p class="muted">Join the league to take your place on the leaderboard.</p>'}</section>`;
  }
  function fixture(f,r){
    const p=f.my_prediction,edit=predictionDrafts.get(f.id)||p,canPlay=joined('predictions')&&!f.locked;
    return `<article class="prediction-fixture"><div class="prediction-fixture-top"><small>${stamp(f.kickoff)} · Castellón time</small><span class="pill ${f.status==='void'?'neutral':''}">${f.status==='final'?'Full time':f.status==='void'?'Voided':f.locked?'Locked':'Open for predictions'}</span></div><h3>${esc(f.home)} <span>vs</span> ${esc(f.away)}</h3>${f.status==='final'?`<div class="prediction-final">Final score <strong>${f.home_score} – ${f.away_score}</strong></div>`:''}${canPlay?`<form data-arcade-form="prediction" data-round="${r.id}" data-fixture="${f.id}" class="prediction-form"><label><span>${esc(f.home)}</span>${number('home',edit?.home,f.home+' predicted goals')}</label><span class="prediction-dash">–</span><label><span>${esc(f.away)}</span>${number('away',edit?.away,f.away+' predicted goals')}</label><button class="btn btn-${p?'outline':'primary'}" type="submit">${p?'Update':'Save'} prediction</button><p class="prediction-saved">${p?'Saved: '+p.home+' – '+p.away:'Not submitted yet'}</p><p class="form-error" role="alert"></p></form>`:`<p class="prediction-summary">${p?`Your prediction: <strong>${p.home} – ${p.away}</strong>${f.status==='final'?` · ${p.points} point${p.points===1?'':'s'}`:''}`:joined('predictions')?'No prediction submitted.':'Join the league to predict this fixture.'}</p>`}${f.locked&&f.predictions.length?`<details class="prediction-others"><summary>Club predictions (${f.predictions.length})</summary>${f.predictions.map(x=>`<div><span>${label(x.user_id)}</span><strong>${x.home} – ${x.away}${f.status==='final'?' · '+x.points+' pts':''}</strong></div>`).join('')}</details>`:''}${state.can_manage?`<div class="prediction-board">${button('Manage result','result',r.id+':'+f.id,'outline')}</div>`:''}</article>`;
  }
  function predictions(){
    const rounds=state.rounds.map((r,i)=>`<details class="prediction-round panel" ${i===0?'open':''}><summary><span><strong>${esc(r.title)}</strong><small>${r.fixtures.length} fixtures · ${r.fixtures.filter(f=>f.my_prediction).length} predictions saved by you</small></span><span class="pill neutral">${r.fixtures.every(f=>f.status!=='scheduled')?'Completed':'View fixtures'}</span></summary><div class="prediction-fixtures">${r.fixtures.map(f=>fixture(f,r)).join('')}</div></details>`).join('');
    return `<div class="games-section-intro"><div><h2>Prediction League</h2><p>Exact score: 3 points. Correct win or draw: 1 point. Predictions lock at kickoff.</p></div><div class="actions">${joined('predictions')?button('Leave league','leave','predictions','outline'):button('Join league','join','predictions')}${state.can_manage?button('New prediction round','new-round','','lime'):''}</div></div>${note('Predict the score after normal time, including added time. Extra time and penalty shoot-outs do not count. Other members’ predictions stay hidden until kickoff. Voided fixtures earn no points.')}<div class="prediction-layout"><div>${rounds||`<div class="panel panel-pad games-empty">${C.icon('calendar',32)}<h3>The next round is on its way</h3><p>${state.can_manage?'Create a round with real upcoming fixtures to get the club started.':'The board will publish the first fixtures here. Join now and you’ll be ready.'}</p></div>`}</div>${league()}</div>`;
  }
  function challengeCard(c){
    const mine=c.challenger===club.user.id?'challenger':'opponent',other=c[mine==='challenger'?'opponent':'challenger'];
    const complete=c.status==='complete',myScore=c[mine+'_score'],otherScore=c[(mine==='challenger'?'opponent':'challenger')+'_score'];
    const status=complete?(myScore>otherScore?'You won':myScore<otherScore?'They won':'Honours even'):c.status==='declined'?'Declined':c.status==='expired'?'Expired':c.my_submitted?'Waiting for your rival':c.other_submitted?'Your rival has played':mine==='opponent'?'You’ve been challenged':'Challenge sent';
    return `<article class="quiz-challenge panel"><div class="quiz-rival">${avatar(other)}<div><h3>${label(other)}</h3><small>${status}</small></div>${complete?`<strong class="quiz-score">${myScore} : ${otherScore}</strong>`:''}</div><p>${complete?'Five questions. One more club story.':c.status==='active'?'Play by '+stamp(c.expires_at)+' · Castellón time':'No result recorded.'}</p><div class="actions">${complete?button('See answers','review',c.id,'outline'):c.status==='active'&&!c.my_submitted?button('Play your five questions','play',c.id):''}${c.status==='active'&&!c.my_submitted&&mine==='opponent'?button('Decline','decline',c.id,'outline'):''}${c.status==='active'&&c.my_submitted?'<span class="pill neutral">Your answers are submitted</span>':''}</div></article>`;
  }
  function quiz(){
    const active=state.challenges.filter(c=>c.status==='active'),history=state.challenges.filter(c=>c.status!=='active');
    return `<div class="games-section-intro"><div><h2>Challenge a teammate</h2><p>Same five questions. One point each. No speed bonus—play when it suits you.</p></div><div class="actions">${joined('quiz')?button('Leave challenges','leave','quiz','outline'):button('Join challenges','join','quiz')}${joined('quiz')?button('Challenge a teammate','new-challenge','','lime'):''}</div></div>${note('Join to receive invitations. Each challenge lasts seven days. Answers and scores are revealed once both players finish. Leaving stops new invitations; you can still finish existing challenges.')}<section><div class="section-title"><h2>Your challenges</h2><span class="muted">${active.length} open</span></div><div class="quiz-challenges">${active.map(challengeCard).join('')||`<div class="panel panel-pad games-empty"><h3>Your next rival is waiting</h3><p>${joined('quiz')?'Challenge an opted-in member to get started.':'Join teammate challenges, then invite someone from the club.'}</p></div>`}</div></section>${history.length?`<section><div class="section-title"><h2>Past challenges</h2></div><div class="quiz-challenges">${history.map(challengeCard).join('')}</div></section>`:''}`;
  }
  function body(){
    if(!state)return `<div class="panel panel-pad" role="status">${error?`<p>${esc(error)}</p>${button('Try again','reload','','outline')}`:'Opening the games room…'}</div>`;
    const view=sub();return `${error?note(esc(error)):''}<nav class="games-tabs" aria-label="Games sections">${[['','Games room'],['predictions','Prediction League'],['quiz','Challenge a teammate']].map(([id,text])=>`<a href="#games${id?'/'+id:''}" ${view===id?'aria-current="page" class="active"':''}>${text}</a>`).join('')}</nav>${view==='predictions'?predictions():view==='quiz'?quiz():overview()}`;
  }
  function paint(){const el=document.getElementById('games-page');if(el){el.innerHTML=body();draft=predictionDrafts.size>0;}}
  function load(){
    if(loadPromise)return loadPromise;
    loadPromise=(async()=>{try{state=await window.api.get('/api/arcade.php');error='';loaded=Date.now();}catch(e){error=e.message;}finally{paint();}})().finally(()=>{loadPromise=null;});
    return loadPromise;
  }
  async function mutate(body,savedFixture=null){if(loadPromise)await loadPromise;await window.api.post('/api/arcade.php',body);if(savedFixture)predictionDrafts.delete(savedFixture);await load();}
  function roundFields(i){return `<fieldset class="round-fixture-fields"><legend>Fixture ${i+1}</legend><div class="form-grid"><label class="field">Home team<input name="home${i}" maxlength="80" ${i===0?'required':''}></label><label class="field">Away team<input name="away${i}" maxlength="80" ${i===0?'required':''}></label></div><label class="field">Kickoff (your local time)<input type="datetime-local" name="kickoff${i}" ${i===0?'required':''}></label></fieldset>`;}
  async function action(name,id){
    if(name==='reload'){await load();return;}
    if(name==='join'){await mutate({action:'join',game:id});C.toast('You’re in. Let the rivalry begin!');location.hash='#games/'+(id==='quiz'?'quiz':'predictions');return;}
    if(name==='leave'){
      C.showDialog('Leave this game?', 'Your previous predictions and results stay recorded.', '<p class="notice">You can join again whenever you like. Existing quiz challenges can still be completed.</p>',async()=>{if(id==='predictions')predictionDrafts.clear();await mutate({action:'leave',game:id});},'Leave game');return;
    }
    if(name==='new-round'){
      let count=5;
      C.showDialog('A new prediction round','Choose real upcoming fixtures. Kickoff times are entered in your device’s local timezone.',`<label class="field">Round name<input name="title" maxlength="100" placeholder="Weekend football · Round 1" required></label><div id="round-fixtures">${Array.from({length:count},(_,i)=>roundFields(i)).join('')}</div>${button('Add another fixture','add-fixture','','outline')}`,async form=>{
        const fixtures=[];for(let i=0;i<count;i++){const home=String(form.get('home'+i)||'').trim(),away=String(form.get('away'+i)||'').trim(),value=form.get('kickoff'+i);if(!home&&!away&&!value)continue;if(!home||!away||!value)throw new Error('Complete both teams and kickoff for every included fixture.');const dt=new Date(value);if(!Number.isFinite(dt.getTime()))throw new Error('Choose a valid kickoff.');fixtures.push({home,away,kickoff:dt.toISOString().replace('.000Z','Z')});}
        await mutate({action:'round_create',title:form.get('title'),fixtures});
      },'Publish round');
      document.querySelector('[data-arcade="add-fixture"]').onclick=e=>{e.stopPropagation();if(count<10)document.getElementById('round-fixtures').insertAdjacentHTML('beforeend',roundFields(count++));if(count===10)e.currentTarget.disabled=true;};return;
    }
    if(name==='result'){
      const [roundId,fixtureId]=id.split(':'),r=state.rounds.find(x=>x.id===roundId),f=r.fixtures.find(x=>x.id===fixtureId);
      C.showDialog('Manage fixture result',f.home+' vs '+f.away,`<p class="notice">Enter the final score after normal time, including added time. Corrections automatically recalculate the leaderboard. Void a cancelled or postponed fixture.</p><label class="field">Fixture status<select name="status"><option value="final" ${f.status==='final'?'selected':''}>Final score</option><option value="void" ${f.status==='void'?'selected':''}>Voided · no points</option><option value="scheduled" ${f.status==='scheduled'?'selected':''}>Scheduled · no final result</option></select></label><div class="prediction-result-inputs"><label class="field">${esc(f.home)}${number('home',f.home_score??0,f.home+' final goals')}</label><label class="field">${esc(f.away)}${number('away',f.away_score??0,f.away+' final goals')}</label></div>`,async form=>{await mutate({action:'fixture_result',round_id:roundId,fixture_id:fixtureId,status:form.get('status'),home:Number(form.get('home')),away:Number(form.get('away'))});},'Save result');return;
    }
    if(name==='new-challenge'){
      const rivals=state.quiz_members.filter(x=>x!==club.user.id);
      if(!rivals.length){C.toast('Ask a teammate to join challenges first.');return;}
      C.showDialog('Pick your rival','Five football questions. Seven days to play.',`<label class="field">Teammate<select name="opponent" required><option value="">Choose a member</option>${rivals.map(x=>`<option value="${x}">${esc(person(x).name)}</option>`).join('')}</select></label><p class="notice">They’ll find your invitation in Games → Challenge a teammate. You can play your own questions straight away.</p>`,async form=>{await mutate({action:'challenge',opponent:form.get('opponent')});},'Send challenge');return;
    }
    const c=state.challenges.find(x=>x.id===id);if(!c)return;
    if(name==='decline'){await mutate({action:'decline',id});C.toast('Challenge declined.');return;}
    if(name==='play'){
      // Refresh first: a second tab may already have submitted this challenge.
      await load();const current=state.challenges.find(x=>x.id===id);if(!current||current.status!=='active'||current.my_submitted){C.toast('This challenge has changed. Check its latest status.');return;}
      const opponent=person(current.challenger===club.user.id?current.opponent:current.challenger);
      C.showDialog('Your five questions','You vs '+opponent.name+' · one submission per player',`<p class="notice">One point per correct answer. Choose all five answers, then submit. Results appear when you have both finished.</p>${current.questions.map((q,i)=>`<fieldset class="quiz-question"><legend><span>${i+1} / 5</span>${esc(q.text)}</legend>${q.options.map((o,j)=>`<label><input type="radio" name="q${i}" value="${j}" required><span>${esc(o)}</span></label>`).join('')}</fieldset>`).join('')}`,async form=>{await mutate({action:'quiz_submit',id,answers:current.questions.map((_,i)=>Number(form.get('q'+i)))});},'Submit my answers');return;
    }
    if(name==='review'){
      C.showDialog('The final whistle','Your answers and the correct answers.',c.questions.map((q,i)=>`<div class="quiz-review"><small>Question ${i+1}</small><h3>${esc(q.text)}</h3><p class="${q.mine===q.correct?'quiz-correct':'quiz-wrong'}">Your answer: ${esc(q.options[q.mine])} ${q.mine===q.correct?'✓':'×'}</p>${q.mine!==q.correct?`<p>Correct answer: ${esc(q.options[q.correct])}</p>`:''}</div>`).join(''));return;
    }
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-arcade]');if(!b||b.disabled||b.dataset.arcade==='add-fixture'||saving)return;
    b.disabled=true;saving=true;try{await action(b.dataset.arcade,b.dataset.id);}catch(err){C?.toast(err.message);}finally{saving=false;if(b.isConnected)b.disabled=false;}
  });
  document.addEventListener('input',e=>{const form=e.target.closest('[data-arcade-form]');if(form){const values=new FormData(form);predictionDrafts.set(form.dataset.fixture,{home:values.get('home'),away:values.get('away')});draft=true;}});
  document.addEventListener('submit',async e=>{
    const form=e.target.closest('[data-arcade-form="prediction"]');if(!form)return;e.preventDefault();if(saving)return;saving=true;const b=e.submitter;b.disabled=true;
    try{const f=new FormData(form);await mutate({action:'predict',round_id:form.dataset.round,fixture_id:form.dataset.fixture,home:Number(f.get('home')),away:Number(f.get('away'))},form.dataset.fixture);C.toast('Prediction saved. You can update it until kickoff.');}catch(err){form.querySelector('.form-error').textContent=err.message;}finally{saving=false;if(b.isConnected)b.disabled=false;}
  });
  window.ClubGames={
    page(data,context){club=data;C=context;draft=predictionDrafts.size>0;if(identity!==data.user.id){predictionDrafts.clear();identity=data.user.id;state=null;loaded=0;error='';draft=false;}return C.heading('A little friendly competition','Games','More football. More reasons to come back.')+`<div id="games-page">${body()}</div>`;},
    mount(){if(Date.now()-loaded>10000&&!draft)void load();},
    hasDraft:()=>location.hash.startsWith('#games')&&draft
  };
})();
