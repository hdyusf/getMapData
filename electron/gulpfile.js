var gulp = require('gulp');
var electron = require('electron-connect').server.create();

gulp.task('server', function () {
  electron.start();
  gulp.watch(['main.js'], electron.restart);
  gulp.watch(['{index,login}.{html,js,css}'], electron.reload);
});