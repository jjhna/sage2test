FROM    ubuntu
MAINTAINER	EVL avatar <evl.avatar@gmail.com>
RUN     apt-get -y update
RUN     apt-get install -y software-properties-common
RUN     add-apt-repository -y ppa:mc3man/xerus-media
RUN     apt-get -y update
RUN     apt-get -y install libavformat-extra libavformat-dev libavcodec-extra libavcodec-dev ffmpeg libavutil-dev git curl libswscale-dev
RUN     curl -sL https://deb.nodesource.com/setup_7.x | sudo bash -
RUN     apt-get -y install wget nodejs ghostscript bzip2 devscripts libx264-dev yasm libnss3-tools libimage-exiftool-perl libgs-dev imagemagick g++ make libgraphviz-dev libmagickcore-dev libmagickwand-dev  libmagick++-dev

COPY    package.json /tmp/package.json
RUN     cd /tmp; npm install
RUN     mkdir -p /sage2; cp -a /tmp/node_modules /sage2/

COPY    . /sage2
EXPOSE  80
EXPOSE  443
WORKDIR /sage2
CMD ["nodejs", "/sage2/server.js", "-f", "/sage2/config/docker-cfg.json", "-i"]
