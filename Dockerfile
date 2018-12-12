FROM    ubuntu:18.04
MAINTAINER	EVL avatar <evl.avatar@gmail.com>
RUN	apt-get update && apt-get install -y apt-utils iproute2
RUN	DEBIAN_FRONTEND=noninteractive TERM=xterm apt-get install -y tzdata
RUN     apt-get install -y \
		software-properties-common build-essential \
		git curl bzip2
RUN     curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN     apt-get update && apt-get install -y \
		ffmpeg \
		libavcodec-dev libavutil-dev libswresample-dev \
		libavformat-dev libswscale-dev \
		ghostscript \
		libnss3-tools \
		libimage-exiftool-perl \
		imagemagick \
		nodejs \
		ntp \
	&& rm -rf /var/lib/apt/lists/*


COPY    package.json /tmp/package.json
RUN     cd /tmp; npm install --production
RUN     mkdir -p /sage2; cp -a /tmp/node_modules /sage2/

# Set this environment variable to true to set timezone on container start.
ENV SET_CONTAINER_TIMEZONE true
# Default container timezone as found under the directory /usr/share/zoneinfo/.
ENV CONTAINER_TIMEZONE America/Chicago

# Fix imagemagick processing PDF
RUN	sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' /etc/ImageMagick-6/policy.xml

COPY    . /sage2

RUN     /sage2/bin/docker_set_timezone.sh
RUN     cd /sage2/keys;./GO-linux

EXPOSE  9090
EXPOSE  9292
WORKDIR /sage2
CMD ["nodejs", "/sage2/server.js", "-f", "/sage2/config/docker-cfg.json", "-i"]

