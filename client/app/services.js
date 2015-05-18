angular.module('codeColab.services', [])


.factory('Share', function ($http, $window, $location, $q, $timeout) {
  var path;
  var ce;

  var getRepos = function ($scope) {
    return $http({
      method: 'GET',
      url: '/api/repos',
    })
    .then(function (repos) {
      $scope.repos = $scope.repos.concat(repos.data);
      return $http({
        method: 'GET',
        url: '/api/orgs'
      })
      .then(function (orgs) {
        orgs.data.forEach(function (org) {
          return $http({
            method: 'POST',
            url: '/api/orgs/repos',
            data: {org: org}
          })
          .then(function (orgRepos){
            orgRepos.data.forEach(function (orgRepo) {
              $scope.repos.push(orgRepo);
            })
            $scope.reposLoaded = true;
          })
        })
      })
    })
  }

  var createBranch = function(repo){
    var deferred = $q.defer();
      deferred.resolve( $http({
          method: 'GET',
          url: '/api/branch/' + repo
      })
      .then (function(exists){
        if (exists.data === false) {
          return $http({
            method: 'POST',
            url: '/api/branch',
            data: {
              repo: repo
            }
          })
          .then(function(branchInfo){
            return(true)  //return ref and sha
          })
        } else {
          return(false);
        }
      }))
      return deferred.promise;
  }

  var commit = function(message, repo, file, $scope){
    var content = ce.editor().getValue(),
        path = file.fullPath,
        sha = file.sha;
    return $http({
      method: 'POST',
      url: '/api/repos',
      data: {
        message: message,
        content: content,
        sha:sha,
        path:path,
        repo:repo
      }
    })
    .then(function(response){
      if (response.status === 200) {
        $scope.currentFile.sha = response.data;
        bootbox.alert("Commit Successful")
        $scope.commitMade = true;
      }
    })
  }

  var loadCM = function($scope) {
    var target = document.getElementById('area')

    $scope.CM = CodeMirror.MergeView(target, {
      'origRight':'This side is the original version of your file.',
      'value':'Select a repository and a file to start editing.  This side is your working document, where you will make your changes.',
      'theme':'erlang-dark',
      lineNumbers:true,
      'readOnly':true
    })
  }

  var loadRepoShare = function($scope) {
    // console.log('right: ',id)
    if($scope.repoShare) {
      $scope.repoShare.rDoc.unsubscribe()
      $scope.repoShare.rSjs.disconnect()
      $scope.repoShare.editingCxt.destroy()
      // $scope.CM.rightOriginal().detachShareJsDoc()
    }

    var rSocket = new BCSocket(null, {reconnect: true});
    var rSjs = new sharejs.Connection(rSocket);
    //need to hash this in the server in some way, for unique encrypted storage
    var rDoc = rSjs.get('adamShareTest', $scope.selected);
    // var rDoc = rSjs.get('adamShareTest', 'testDoc');
    $scope.repoShare = {rDoc: rDoc, rSjs: rSjs}

    rDoc.subscribe()

    rDoc.whenReady(function() {

      if (!rDoc.type) {
        //create json instead of text
        rDoc.create('json0')

        //need to do a submit op to 'seed' the json structure - this line will be changed if we want to add more stuff
        rDoc.submitOp([{p:[],od:null,oi:{origTextTrigger:[0],treeStructure:[0],commitAndMergeIndicators:{'commit':false,'merge':false}}}]) // might use set here instead
        
        // console.log('created: ',rDoc)
      }

      rDoc.subscribe(function(err) {
        // console.log('rDoc subscribed: ',rDoc)

      //create new context for editor, tree, commit, and merge (maybe cursors and user list later on) to listen to
      //we could probably create indicators to display which files have been changed/not committed, or are being worked in
      $scope.repoShare.editingCxt = rDoc.createContext()
      $scope.origTextTrigger = $scope.repoShare.editingCxt.createContextAt('origTextTrigger')
      $scope.treeStructure = $scope.repoShare.editingCxt.createContextAt('treeStructure')
      $scope.commitAndMergeIndicators = $scope.repoShare.editingCxt.createContextAt('commitAndMergeIndicators')

      //set variables that we watch for displaying commit/merge buttons
      $scope.commitInd = $scope.commitAndMergeIndicators.get().commit
      $scope.mergeInd = $scope.commitAndMergeIndicators.get().merge

      //create event listeners for each of the above variables/contexts
      $scope.treeStructure.on('replace', function() { 
        console.log('replace entered',$scope.treeStructure.get()[0])

        //had to use timeout so that angular knows to render the scope change next chance it gets
        $timeout(function() {
          $scope.$parent.tree = JSON.parse($scope.treeStructure.get()[0])
          // $scope.$apply() - not needed for now
        })
        // console.log('tree replaced: ',$scope.$parent.tree,$scope.tree,$scope.treeStructure.get()[0])
      })

      // $scope.treeStructure.on('child op', function(path,op) {
      //   console.log('child op',path,op)
      // })
      
      // $scope.treeStructure.on('insert', function() {
      //   console.log('inserted')
      // })
      
      // $scope.treeStructure.on('delete', function() {
      //   console.log('deleted')
      // })

      $scope.commitAndMergeIndicators.on('replace', function() {
        console.log('c/m replaced')
        $timeout(function() {
          $scope.commitInd = $scope.commitAndMergeIndicators.get().commit
          $scope.mergeInd = $scope.commitAndMergeIndicators.get().merge
        })
      })

      $scope.origTextTrigger.on('replace', function() {
        console.log('fetching original text')
        //somehow trigger fetching original text from master branch in GitHub, then setting right value to that text

      })

      //I used this stuff all for testing - delete it 

      // setInterval(function() {
      //   console.log('interval: ',rDoc.snapshot.treeStructure[0],$scope.tree)
      //   rDoc.submitOp([
      //     {p:['treeStructure',0],ld:rDoc.snapshot.treeStructure[0],li:JSON.stringify($scope.tree)}
      //   ])
      // },4500)
      
      // setTimeout(function() {
      //   // console.log($scope.treeStructure.get())
      //   // replace is what fires here - child op might fire also
      //   // replace also fires even if new value is the same
      //   rDoc.submitOp([
      //     {p:['treeStructure',0],ld:rDoc.snapshot.treeStructure[0],li:[{label:'test100', fullPath: '', url:'', id:1, children:[]},{label:'test200', fullPath: '', url:'', id:2, children:[{label:'test2200', fullPath: '', url:'', id:3, children:[]}]}]}
      //   ])
      //   // for objects
      //   // rDoc.submitOp([
      //   //   {p:['treeStructure','a'],od:rDoc.snapshot.treeStructure.a,oi:Math.random()}
      //   // ])
      //   //for just inserting into arrays
      //   // rDoc.submitOp([
      //   //   {p:['treeStructure',10],li:Math.random()} //this one actually triggers insert
      //   // ])
      //   // $scope.treeStructure.push(Math.random())
      //   console.log('treeStructure: ',$scope.treeStructure.get())
      // },8500)

      //pass context into attachCodeMirror function where appropriate
      //add context event listeners

      // $state.submitOp([
      //   {p:['grid','values'],od:$state.snapshot.grid.values,oi:grid.values},
      //   {p:['playerTurn'],od:$state.snapshot.playerTurn,oi:playerTurn}
      // ]);

        //if doc is new, set value based on GH master so we can update origDocuments collection

        // var newRight = rDoc.getSnapshot()==='' ? CodeMirror.Doc('testing some stuff','javascript') : CodeMirror.Doc('testing some stuff','javascript')
        // console.log('newRight value: ',newRight.getValue())

        // $scope.CM.rightOriginal().swapDoc(newRight)
        // console.log('rightOriginal value: ',$scope.CM.rightOriginal().getValue())

        // need to restore this somehow - maybe?
        // should probably get rid of this rightOrig CodeMirror - we will probably just load the value from GitHub each time the page loads
        // rDoc.attachCodeMirror($scope.CM.rightOriginal(),$scope.origText)
        // console.log('rDoc attached: ',rDoc)

        // if($scope.origTextTrigger.get()==='') {
        //   //should we run updaterightOrigValue here?
        //   $scope.CM.rightOriginal().setValue(data)
        //   console.log('snapshot: ',rDoc.getSnapshot())
        //   // rDoc.submitOp([
        //   //   {p:['origText'],od:'',oi:data}
        //   // ])
        //   $scope.origText.set(data)
        //   console.log('snapshot 2: ',rDoc.getSnapshot())

        //   // console.log('should be rDoc value: ',$scope.CM.rightOriginal().getValue())
        // }

      })

      //need to split this out so that it runs when a file is selected
      // loadShare($scope,id,data)
    })

  }

  var updateRightOrigValue = function($scope, branch) {

    // if($scope.right) {
    //   $scope.right.rDoc.unsubscribe()
    //   $scope.right.rSjs.disconnect()
      // $scope.CM.rightOriginal().detachShareJsDoc()
    // }
    //just set value of rightOrig
    return $http ({
      method:'POST',
      url: '/api/getUpdatedFile',
      data: {
        filePath: $scope.currentFile.fullPath,
        ownerAndRepo: $scope.selected,
        branch: branch
      }
    })
    .then (function (data) {
      // need to change all of this stuff

      // console.log(data)
      var newRight = CodeMirror.Doc(data.data.file,'javascript')
      // $scope.CM.rightOriginal().swapDoc(newRight)
      $scope.CM.rightOriginal().setValue(data.data.file)
    });
  }

  var resetCM = function($scope) {
    if($scope.share) {
      $scope.share.doc.unsubscribe()
      $scope.share.sjs.disconnect()
      // $scope.repoShare.rDoc.unsubscribe()
      // $scope.repoShare.rSjs.disconnect()
      $scope.CM.editor().detachShareJsDoc()
      // $scope.CM.rightOriginal().detachShareJsDoc()
    }

    // $scope.CM.rightOriginal().setValue('')

    var placeholderDoc = CodeMirror.Doc('Select a file to start editing.  You will make your changes in this editor.','javascript')
    $scope.CM.editor().swapDoc(placeholderDoc)
    $scope.CM.editor().setOption('readOnly', true)

    var placeholderRight = CodeMirror.Doc('This will display the original text.', 'javascript')
    $scope.CM.rightOriginal().swapDoc(placeholderRight)

  }

  var loadShare = function ($scope, id, data) {
    // this fires if we already have an existing doc and connection
    if($scope.share){
      $scope.share.doc.unsubscribe()
      $scope.share.sjs.disconnect()
      $scope.CM.editor().detachShareJsDoc()
      //add stuff for other connection and rightOriginal() here
    }

    var socket = new BCSocket(null, {reconnect: true});
    var sjs = new sharejs.Connection(socket);
    var doc = sjs.get('documents', id);

    doc.subscribe()

    doc.whenReady(function() {
      if (!doc.type) {
        doc.create('text');
      }

      doc.subscribe(function(err) {

        //this is the new doc - we need to use a doc for a swap
        var newEditor = doc.getSnapshot()==='' ? CodeMirror.Doc(data,'javascript') : CodeMirror.Doc(doc.getSnapshot(),'javascript')

        // $scope.CM.editor().setValue(newEditor.getValue())
        $scope.CM.editor().swapDoc(newEditor)

        // $scope.CM.rightOriginal().setValue(data);
        doc.attachCodeMirror($scope.CM.editor())

        // probably some more efficient way to do this, but it works for now - if doc exists in
        // origDocs database but not in regular Docs database, this will copy the string into the editor immediately after
        // the subscription takes hold, which also copies it into the Docs database.
        if(doc.getSnapshot()==='') {
          $scope.CM.editor().setValue($scope.CM.rightOriginal().getValue())
        }

        $scope.CM.editor().setOption('readOnly',false)
        // console.log('after subscribed',doc.getSnapshot(),codeEditor.editor().getValue())
        ce = $scope.CM

        //below is for the text editor spinner
        $scope.$parent.$apply(function () {
          $scope.$parent.editorHasLoaded()
        })
      });

    });

    //need to finish importing all of the sublime shortcuts and whatnot: http://codemirror.net/doc/manual.html#addons

    // this is the syntax needed for .getValue and .setValue.  rightOriginal, leftOriginal, and editor are all
    // of the possible CodeMirror instances; we only use editor and rightOriginal in our version right now.
    // console.log('editor: ',codeEditor.editor().getValue(),"\n",'original: ',codeEditor.rightOriginal().getValue())
    // codeEditor.editor().setValue('this is a test')

    // return connection and doc, so that we can disconnect from them later if needed
    // otherwise, the connection or doc subscription or both build up and make us unable to fetch other documents
    $scope.share = {sjs:sjs,doc:doc}
  }

  var loadFile = function ($scope, file) {
    $scope.$parent.currentFile = file;

    return $http ({
      method:'POST',
      url: '/api/files',
      data: {
        url: file.url,
        fileId: file.id
      }
    })
    .then (function (data) {
      $scope.$parent.fileLoaded = true;
      $scope.$parent.currentFile.sha = data.data.fileSha;
      console.log('fileSha: ',that.fileSha,data.data.fileSha)
      // this function doesn't exist anymore
      // resetRightOrig($scope, id, data.data.file)
      loadShare($scope, id, data.data.file)
      updateRightOrigValue($scope,'master')
    });
  }

  var checkForApp = function($scope, repo) {
    var that = this;
    return $http({
      method : 'GET',
      url: '/api/apps/'+repo
    })
      .then (function(response){
        if (response.data === false) {
          if($scope.deployApp) {
            $scope.deployApp();
          }
        } else {
          $scope.deploying=true;
         that.rebuild($scope, repo)
        }
      })
  }

  var showLog = function (name, repo, buildId) {
    var appURL ='https://'+name+'.herokuapp.com';
    var buildId = buildId? '/'+buildId : '';
    return $http({
      method: "GET",
      url: 'api/deploy/'+ repo + buildId
    })
    .then (function (response){
      $location.path('/');
      var re = /\n/g;
      var log = response.data.replace(re, '<br>')
      bootbox.alert("Heroku Build Log<br>"+ log, function () {
        return;
      });
      $window.open(appURL)
    })
  }

  var deployApp = function($scope, name){
    var repo = localStorage.repo,
        that = this;
    return $http({
      method: 'POST',
      url: '/api/deploy',
      data: {
        repo: repo,
        name: name
      }
    })
    .then (function(response){
      var name = response.data.name;
      if (name === 'taken') {
        bootbox.alert("That name is already taken.", function () {
          $scope.first = true;
          $scope.deployApp()
        })
      } else if (name === 'creditLimit') {
        bootbox.alert("Heroku will not let you create any more apps without a credit card number. Please resolve with Heroku and try again.", function() {
          $scope.first = true;
          $location.path('/');
        })
      } else {
        that.showLog(name, repo);
      }
    })
  }


  var rebuild = function($scope, repo) {
    var that = this;
    return $http({
      method: 'POST',
      url: '/api/builds',
      data: {
        repo: repo
      }
    })
    .then (function (response) {
      if ($location.path() === '/deploy') {
        $scope.deploy = "building!";
        var name = response.data.name;
        var buildId = response.data.buildId;
        that.showLog(name, repo, buildId);
      }
    })
  }


  var mergeBranch = function(repo, title, comments, $scope) {
    var that = this;
    return $http({
      method: 'POST',
      url: '/api/merge',
      data: {
        repo: repo,
        title: title,
        comments: comments
      }
    })
    .then (function(response) {
      if (response.status === 200) {
        if (response.data === "No commits between master and CODECOLAB") {
          bootbox.alert("You have not committed anything to this branch.");
        } else if (response.data === "A pull request already exists for BraveBravos:CODECOLAB.") {
          bootbox.alert("You have an outstanding pull request on this branch. Please resolve on GitHub.")
        }else {
          bootbox.alert("Merge Successful")
          that.checkForApp($scope, repo)
          //rightOrig value update is triggered in the controller
        }
      }
    })
  }

  var checkName = function (name) {
    var re = /^[a-z](?:[a-z]|\d|-)*/;
    return re.test(name);
  }

  return {
    getRepos : getRepos,
    loadShare: loadShare,
    commit: commit,
    createBranch: createBranch,
    loadCM: loadCM,
    resetCM: resetCM,
    loadFile: loadFile,
    checkForApp: checkForApp,
    deployApp: deployApp,
    rebuild: rebuild,
    showLog: showLog,
    checkName: checkName,
    mergeBranch: mergeBranch,
    loadRepoShare: loadRepoShare,
    updateRightOrigValue: updateRightOrigValue
  }
})




