WebSAGE
=======

Browser based implementation of SAGE. A cluster-based html viewer used for displaying elements across multiple browser windows.

### Requirements ###
* ffmpeg
* poppler

##### For Windows: #####

* Download and install [7-Zip](http://www.7-zip.org/)
* Download [FFMpeg](http://ffmpeg.zeranoe.com/builds/)
* Download [Poppler-utils](http://manifestwebdesign.com/2013/01/09/xpdf-and-poppler-utils-on-windows/)

Install FFMpeg
* Move the FFMpeg 7-zip file to "C:\"
* Right-click, go to 7-Zip > Extract Here
* Rename extracted folder to "FFMpeg"

Install Poppler
* Create Folder "C:\Poppler"
* Move the Poppler-utils zip file to "C:\Poppler"
* Right-click, go to 7-Zip > Extract Here

Set Environment
* Add both "C:\FFMpeg" and "C:\Poppler" to you PATH variable


##### For Mac OSX: #####

```
brew install ffmpeg 
brew install poppler --with-glib
```


##### To install all Node js modules: #####
```
npm install
```

### Installing the webBrowser ###
#### Prerequisites (libraries) ####
Awesomium: http://www.awesomium.com

##### Mac OSX #####
```
brew install boost libjpeg-turbo
sudo easy_install pip
```

##### OpenSuse #####
```
sudo zypper in boost-devel libjpeg-turbo python-pip
```

#### Prerequisites (python libraries) ####
To install the python prerequisites you can use pip
```
sudo pip install Twisted autobahn
```

#### Installation ####
```
cd webBrowser/awesomium
mkdir build
cd build
cmake ../
make
```
