REM Must be run as administrator
pushd %~dp0
call init_webserver.bat localhost
call init_webserver.bat 127.0.0.1
call init_webserver.bat hopper.evl.uic.edu