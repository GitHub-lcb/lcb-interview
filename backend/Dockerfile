FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /app
COPY pom.xml .
COPY .mvn ./.mvn
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
COPY scripts ./scripts
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app
COPY --from=build /app/target/lcb-interview-0.0.1-SNAPSHOT.jar /app/app.jar

ENV JAVA_OPTS="-Xms256m -Xmx768m -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS} -jar /app/app.jar"]
